package com.version1.recognition.nomination;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class ResubmissionRequestResponse {

    private final UUID id;
    private final UUID nominationId;
    private final String recipientEmail;
    private final String requestedByEmail;
    private final List<EvaluationResponse.CriterionView> failingCriteria;
    private final String message;
    private final Instant sentAt;

    public ResubmissionRequestResponse(ResubmissionRequest request) {
        this.id = request.getId();
        this.nominationId = request.getNominationId();
        this.recipientEmail = request.getRecipientEmail();
        this.requestedByEmail = request.getRequestedByEmail();
        this.failingCriteria = request.getFailingCriteria().stream()
                .map(EvaluationResponse.CriterionView::new)
                .toList();
        this.message = request.getMessage();
        this.sentAt = request.getSentAt();
    }

    public UUID getId() {
        return id;
    }

    public UUID getNominationId() {
        return nominationId;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public String getRequestedByEmail() {
        return requestedByEmail;
    }

    public List<EvaluationResponse.CriterionView> getFailingCriteria() {
        return failingCriteria;
    }

    public String getMessage() {
        return message;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
