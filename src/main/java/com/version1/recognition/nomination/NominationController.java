package com.version1.recognition.nomination;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/nominations")
public class NominationController {

    private final NominationService service;
    private final ResubmissionService resubmissionService;

    public NominationController(NominationService service, ResubmissionService resubmissionService) {
        this.service = service;
        this.resubmissionService = resubmissionService;
    }

    // Epic 1: submit a nomination (or a resubmission, if originalNominationId is set)
    @PostMapping
    public ResponseEntity<NominationResponse> submit(@Valid @RequestBody NominationRequest request) {
        Nomination nomination = service.submit(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new NominationResponse(nomination));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NominationResponse> getById(@PathVariable UUID id) {
        Nomination nomination = service.findById(id);
        return ResponseEntity.ok(
                new NominationResponse(nomination, resubmissionService.evaluate(nomination)));
    }

    // Epic 6: backing endpoint for the dashboard - one row per nomination
    @GetMapping
    public ResponseEntity<List<NominationResponse>> getAll() {
        List<NominationResponse> all = service.findAll().stream()
                .map(n -> new NominationResponse(n, resubmissionService.evaluate(n)))
                .collect(Collectors.toList());
        return ResponseEntity.ok(all);
    }

    /**
     * What the evaluation makes of this nomination. Read-only and side-effect
     * free - it sends nothing, so a coordinator can look before asking.
     */
    @GetMapping("/{id}/evaluation")
    public ResponseEntity<EvaluationResponse> evaluation(@PathVariable UUID id) {
        return ResponseEntity.ok(new EvaluationResponse(resubmissionService.evaluate(id)));
    }

    /** Sends the nominator a request to complete the nomination. */
    @PostMapping("/{id}/request-resubmission")
    public ResponseEntity<ResubmissionRequestResponse> requestResubmission(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) RequestResubmissionRequest body) {
        String coordinatorEmail = body == null ? null : body.getCoordinatorEmail();
        ResubmissionRequest request = resubmissionService.requestResubmission(id, coordinatorEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(new ResubmissionRequestResponse(request));
    }

    /** The audit trail: every resubmission request sent for this nomination. */
    @GetMapping("/{id}/resubmission-requests")
    public ResponseEntity<List<ResubmissionRequestResponse>> resubmissionRequests(@PathVariable UUID id) {
        List<ResubmissionRequestResponse> all = resubmissionService.findRequestsFor(id).stream()
                .map(ResubmissionRequestResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(all);
    }
}
