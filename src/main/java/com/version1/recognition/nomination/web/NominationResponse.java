package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.evaluation.AiEvaluationStatus;
import com.version1.recognition.nomination.model.AwardCategory;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.NominationStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class NominationResponse {

    private final UUID id;
    private final String nominatorName;
    // Emails are exposed alongside the names because the display name is too weak
    // a key to identify a person by: the UI filters "recognition involving me" on
    // these, and a coordinator needs to know who to contact about a decision.
    private final String nominatorEmail;
    private final String nomineeName;
    private final String nomineeEmail;
    private final String practice;
    private final String location;
    private final AwardCategory category;
    private final String categoryLabel;
    private final CoreValue coreValue;
    private final String coreValueLabel;
    private final String whatText;
    private final String howText;
    private final NominationStatus status;
    private final List<NominationFlagResponse> aiFlags;
    private final Integer aiScore;
    private final String aiRationale;
    private final String aiPromptVersion;
    private final AiEvaluationStatus aiEvaluationStatus;
    private final String rejectionReason;
    private final UUID originalNominationId;
    private final Instant submittedAt;
    private final Instant decisionDate;
    private final Instant commsSentDate;

    public NominationResponse(Nomination nomination) {
        this.id = nomination.getId();
        this.nominatorName = nomination.getNominatorName();
        this.nominatorEmail = nomination.getNominatorEmail();
        this.nomineeName = nomination.getNomineeName();
        this.nomineeEmail = nomination.getNomineeEmail();
        this.practice = nomination.getPractice();
        this.location = nomination.getLocation();
        this.category = nomination.getCategory();
        this.categoryLabel = nomination.getCategory() == null ? null : nomination.getCategory().getLabel();
        this.coreValue = nomination.getCoreValue();
        this.coreValueLabel = nomination.getCoreValue() == null ? null : nomination.getCoreValue().getLabel();
        this.whatText = nomination.getWhatText();
        this.howText = nomination.getHowText();
        this.status = nomination.getStatus();
        this.aiFlags = nomination.getAiFlags().stream()
                .map(NominationFlagResponse::new)
                .collect(java.util.stream.Collectors.toList());
        this.aiScore = nomination.getAiScore();
        this.aiRationale = nomination.getAiRationale();
        this.aiPromptVersion = nomination.getAiPromptVersion();
        this.aiEvaluationStatus = nomination.getAiEvaluationStatus();
        this.rejectionReason = nomination.getRejectionReason();
        this.originalNominationId = nomination.getOriginalNominationId();
        this.submittedAt = nomination.getSubmittedAt();
        this.decisionDate = nomination.getDecisionDate();
        this.commsSentDate = nomination.getCommsSentDate();
    }

    public UUID getId() {
        return id;
    }

    public String getNominatorName() {
        return nominatorName;
    }

    public String getNominatorEmail() {
        return nominatorEmail;
    }

    public String getNomineeName() {
        return nomineeName;
    }

    public String getNomineeEmail() {
        return nomineeEmail;
    }

    public String getPractice() {
        return practice;
    }

    public String getLocation() {
        return location;
    }

    public AwardCategory getCategory() {
        return category;
    }

    public String getCategoryLabel() {
        return categoryLabel;
    }

    public CoreValue getCoreValue() {
        return coreValue;
    }

    public String getCoreValueLabel() {
        return coreValueLabel;
    }

    public String getWhatText() {
        return whatText;
    }

    public String getHowText() {
        return howText;
    }

    public NominationStatus getStatus() {
        return status;
    }

    public List<NominationFlagResponse> getAiFlags() {
        return aiFlags;
    }

    public Integer getAiScore() {
        return aiScore;
    }

    public String getAiRationale() {
        return aiRationale;
    }

    public String getAiPromptVersion() {
        return aiPromptVersion;
    }

    public AiEvaluationStatus getAiEvaluationStatus() {
        return aiEvaluationStatus;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public UUID getOriginalNominationId() {
        return originalNominationId;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getDecisionDate() {
        return decisionDate;
    }

    public Instant getCommsSentDate() {
        return commsSentDate;
    }
}
