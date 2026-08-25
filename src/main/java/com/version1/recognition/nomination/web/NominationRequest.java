package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.AwardCategory;
import com.version1.recognition.nomination.model.CoreValue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class NominationRequest {

    @NotBlank(message = "Nominator name is required")
    private String nominatorName;

    // In the real system this is captured from the logged-in user, not the
    // form itself - kept as an explicit field here since there's no auth yet.
    @NotBlank(message = "Nominator email is required")
    @Email(message = "Nominator email must be valid")
    private String nominatorEmail;

    @NotBlank(message = "Nominee name is required")
    private String nomineeName;

    @NotBlank(message = "Nominee email is required")
    @Email(message = "Nominee email must be valid")
    private String nomineeEmail;

    @NotBlank(message = "Practice is required")
    private String practice;

    @NotBlank(message = "Location is required")
    private String location;

    @NotNull(message = "Category is required - pick the business category this nomination fits")
    private AwardCategory category;

    // Optional. The form asks for the value in the HOW text rather than from a
    // dropdown, so this normally arrives null and the service works it out from
    // what was written. Kept on the DTO so an API client can still state it
    // outright if it knows.
    private CoreValue coreValue;

    @NotBlank(message = "WHAT is required - describe the achievement, contribution, or action")
    private String whatText;

    @NotBlank(message = "HOW is required - explain how the nominee demonstrated the value you selected")
    private String howText;

    // Set by the client when this submission is a resubmission of a rejected
    // nomination. Null for a first-time submission.
    private UUID originalNominationId;

    public String getNominatorName() {
        return nominatorName;
    }

    public void setNominatorName(String nominatorName) {
        this.nominatorName = nominatorName;
    }

    public String getNominatorEmail() {
        return nominatorEmail;
    }

    public void setNominatorEmail(String nominatorEmail) {
        this.nominatorEmail = nominatorEmail;
    }

    public String getNomineeName() {
        return nomineeName;
    }

    public void setNomineeName(String nomineeName) {
        this.nomineeName = nomineeName;
    }

    public String getNomineeEmail() {
        return nomineeEmail;
    }

    public void setNomineeEmail(String nomineeEmail) {
        this.nomineeEmail = nomineeEmail;
    }

    public String getPractice() {
        return practice;
    }

    public void setPractice(String practice) {
        this.practice = practice;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
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

    public void setWhatText(String whatText) {
        this.whatText = whatText;
    }

    public String getHowText() {
        return howText;
    }

    public void setHowText(String howText) {
        this.howText = howText;
    }

    public UUID getOriginalNominationId() {
        return originalNominationId;
    }

    public void setOriginalNominationId(UUID originalNominationId) {
        this.originalNominationId = originalNominationId;
    }
}
