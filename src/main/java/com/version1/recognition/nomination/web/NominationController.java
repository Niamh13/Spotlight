package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.Nomination;
import com.version1.recognition.nomination.NominationService;
import com.version1.recognition.nomination.NominationStatus;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/nominations")
public class NominationController {

    private final NominationService service;

    public NominationController(NominationService service) {
        this.service = service;
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

    // Audit and activity history view
    @GetMapping("/{id}/audit-log")
    public ResponseEntity<List<AuditLogEntryResponse>> getAuditLog(@PathVariable UUID id) {
        List<AuditLogEntryResponse> entries = service.getAuditLog(id).stream()
                .map(AuditLogEntryResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(entries);
    }
}
