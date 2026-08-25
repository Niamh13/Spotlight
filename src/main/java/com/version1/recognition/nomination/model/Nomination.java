package com.version1.recognition.nomination.model;

import com.version1.recognition.nomination.evaluation.AiEvaluationStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "nominations")
public class Nomination {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.CHAR)
    private UUID id;

    @Column(nullable = false)
    private String nominatorName;

    @Column(nullable = false)
    private String nominatorEmail;

    @Column(nullable = false)
    private String nomineeName;

    @Column(nullable = false)
    private String nomineeEmail;

    @Column(nullable = false)
    private String practice;

    @Column(nullable = false)
    private String location;

    // Which of the five business categories this nomination is filed under.
    // Nullable in the database because rows created before categories existed
    // have none; required on every new submission (see NominationRequest).
    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 50)
    private AwardCategory category;

    // Which of Version 1's six core values the nominator says was demonstrated.
    // Nullable for rows created before the picker existed; required on every new
    // submission. The HOW text explains how this particular value was shown.
    @Enumerated(EnumType.STRING)
    @Column(name = "core_value", length = 50)
    private CoreValue coreValue;

    // WHAT: the achievement, contribution, or action
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false)
    private String whatText;

    // HOW: how it demonstrated a Version 1 core value
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false)
    private String howText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NominationStatus status;

    // Advisory only - the coordinator makes the decision, neither the rules nor
    // the AI ever do (Epic 2). Each entry carries the reason it was raised, so a
    // reviewer can act on the flag without re-deriving the judgement themselves.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "nomination_ai_flags", joinColumns = @JoinColumn(name = "nomination_id"))
    private List<NominationFlag> aiFlags = new ArrayList<>();

    // Set when a coordinator rejects (Epic 3) - mandatory at that point, null until then.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String rejectionReason;

    // AI evaluation results (Epic 2). Score/rationale come from the Groq call;
    // null until an evaluation runs. promptVersion records which prompt file
    // produced this result, for traceability if the prompt changes later.
    private Integer aiScore;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String aiRationale;

    private String aiPromptVersion;

    @Enumerated(EnumType.STRING)
    private AiEvaluationStatus aiEvaluationStatus;

    // Links a resubmission back to the nomination it replaces (Epic 3).
    @JdbcTypeCode(SqlTypes.CHAR)
    private UUID originalNominationId;

    // Who made the approve/reject call (Epic 3).
    private String coordinatorEmail;

    @Column(nullable = false)
    private Instant submittedAt;

    private Instant decisionDate;

    private Instant commsSentDate;

    protected Nomination() {
        // required by JPA
    }

    public Nomination(String nominatorName, String nominatorEmail, String nomineeName, String nomineeEmail,
                       String practice, String location, AwardCategory category,
                       CoreValue coreValue, String whatText, String howText,
                       UUID originalNominationId) {
        this.nominatorName = nominatorName;
        this.nominatorEmail = nominatorEmail;
        this.nomineeName = nomineeName;
        this.nomineeEmail = nomineeEmail;
        this.practice = practice;
        this.location = location;
        this.category = category;
        this.coreValue = coreValue;
        this.whatText = whatText;
        this.howText = howText;
        this.originalNominationId = originalNominationId;
        this.status = NominationStatus.PENDING_REVIEW;
        this.submittedAt = Instant.now();
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

    public void setCategory(AwardCategory category) {
        this.category = category;
    }

    public CoreValue getCoreValue() {
        return coreValue;
    }

    public void setCoreValue(CoreValue coreValue) {
        this.coreValue = coreValue;
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

    public void setStatus(NominationStatus status) {
        this.status = status;
    }

    public List<NominationFlag> getAiFlags() {
        return aiFlags;
    }

    public void setAiFlags(List<NominationFlag> aiFlags) {
        // Mutate the existing collection rather than swapping the reference:
        // Hibernate tracks element collections by identity, and replacing the
        // instance outright makes a retag throw rather than update in place.
        this.aiFlags.clear();
        if (aiFlags != null) {
            this.aiFlags.addAll(aiFlags);
        }
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public Integer getAiScore() {
        return aiScore;
    }

    public void setAiScore(Integer aiScore) {
        this.aiScore = aiScore;
    }

    public String getAiRationale() {
        return aiRationale;
    }

    public void setAiRationale(String aiRationale) {
        this.aiRationale = aiRationale;
    }

    public String getAiPromptVersion() {
        return aiPromptVersion;
    }

    public void setAiPromptVersion(String aiPromptVersion) {
        this.aiPromptVersion = aiPromptVersion;
    }

    public AiEvaluationStatus getAiEvaluationStatus() {
        return aiEvaluationStatus;
    }

    public void setAiEvaluationStatus(AiEvaluationStatus aiEvaluationStatus) {
        this.aiEvaluationStatus = aiEvaluationStatus;
    }

    public UUID getOriginalNominationId() {
        return originalNominationId;
    }

    public String getCoordinatorEmail() {
        return coordinatorEmail;
    }

    public void setCoordinatorEmail(String coordinatorEmail) {
        this.coordinatorEmail = coordinatorEmail;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getDecisionDate() {
        return decisionDate;
    }

    public void setDecisionDate(Instant decisionDate) {
        this.decisionDate = decisionDate;
    }

    public Instant getCommsSentDate() {
        return commsSentDate;
    }

    public void setCommsSentDate(Instant commsSentDate) {
        this.commsSentDate = commsSentDate;
    }
}
