package com.version1.recognition.nomination;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class ReviewDecisionRequest {

    @NotBlank(message = "Coordinator email is required")
    @Email(message = "Coordinator email must be valid")
    private String coordinatorEmail;

    @NotBlank(message = "A reason is required")
    private String reason;

    public String getCoordinatorEmail() {
        return coordinatorEmail;
    }

    public void setCoordinatorEmail(String coordinatorEmail) {
        this.coordinatorEmail = coordinatorEmail;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
