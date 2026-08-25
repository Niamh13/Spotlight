package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.NominationStatus;
import com.version1.recognition.nomination.service.CompletenessCriterion;
import com.version1.recognition.nomination.service.CompletenessService;
import com.version1.recognition.nomination.service.NominationService;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/nominations")
public class NominationController {

    private final NominationService service;
    private final CompletenessService completenessService;

    public NominationController(NominationService service,
                                 CompletenessService completenessService) {
        this.service = service;
        this.completenessService = completenessService;
    }

    // Epic 1: submit a nomination (or a resubmission, if originalNominationId is set)
    @PostMapping
    public ResponseEntity<NominationResponse> submit(@Valid @RequestBody NominationRequest request) {
        Nomination nomination = service.submit(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new NominationResponse(nomination));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NominationResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(new NominationResponse(service.findById(id)));
    }

    // Epic 6 / reviewer dashboard: ?status=PENDING_REVIEW backs the review queue,
    // no param backs the full dashboard.
    @GetMapping
    public ResponseEntity<List<NominationResponse>> getAll(
            @RequestParam(required = false) NominationStatus status) {
        List<NominationResponse> all = service.findAll(status).stream()
                .map(NominationResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(all);
    }

    // Epic 3: coordinator actions
    @PostMapping("/{id}/approve")
    public ResponseEntity<NominationResponse> approve(@PathVariable UUID id,
                                                        @Valid @RequestBody ApproveRequest request) {
        return ResponseEntity.ok(new NominationResponse(service.approve(id, request)));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<NominationResponse> reject(@PathVariable UUID id,
                                                       @Valid @RequestBody ReviewDecisionRequest request) {
        return ResponseEntity.ok(new NominationResponse(service.reject(id, request)));
    }

    @PostMapping("/{id}/request-resubmission")
    public ResponseEntity<NominationResponse> requestResubmission(@PathVariable UUID id,
                                                                    @Valid @RequestBody ReviewDecisionRequest request) {
        return ResponseEntity.ok(new NominationResponse(service.requestResubmission(id, request)));
    }

    /**
     * Forces a rule-flag pass over every nomination. Submitting already retags
     * automatically; this exists for the case the rules themselves change, where
     * nothing new has been submitted to trigger a pass but every existing answer
     * may now be wrong.
     */
    @PostMapping("/retag")
    public ResponseEntity<Map<String, Object>> retag() {
        int flagged = service.retagAll();
        return ResponseEntity.ok(Map.of(
                "flaggedNominations", flagged,
                "message", "Rule flags recomputed. AI flags were left untouched."));
    }

    /**
     * The one-click completeness check (brief: "Completeness check, single
     * click"). Returns every criterion with its pass/fail, plus a ready-made
     * message listing what is missing - which the coordinator can send back as-is
     * or edit.
     */
    @GetMapping("/{id}/completeness")
    public ResponseEntity<Map<String, Object>> completeness(@PathVariable UUID id) {
        Nomination nomination = service.findById(id);
        Map<CompletenessCriterion, Boolean> assessed = completenessService.assess(nomination);

        List<Map<String, Object>> criteria = assessed.entrySet().stream()
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<String, Object>();
                    row.put("criterion", e.getKey().name());
                    row.put("label", e.getKey().getLabel());
                    row.put("remedy", e.getKey().getRemedy());
                    row.put("passed", e.getValue());
                    return row;
                })
                .collect(Collectors.toList());

        long failed = assessed.values().stream().filter(passed -> !passed).count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("complete", failed == 0);
        body.put("passedCount", assessed.size() - failed);
        body.put("totalCount", assessed.size());
        body.put("criteria", criteria);
        body.put("suggestedMessage", completenessService.toResubmissionMessage(nomination));
        return ResponseEntity.ok(body);
    }

    // Audit and activity history view
    @GetMapping("/{id}/audit-log")
    public ResponseEntity<List<AuditLogEntryResponse>> getAuditLog(@PathVariable UUID id) {
        List<AuditLogEntryResponse> entries = service.getAuditLog(id).stream()
                .map(AuditLogEntryResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(entries);
    }
}
