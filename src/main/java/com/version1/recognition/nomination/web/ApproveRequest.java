package com.version1.recognition.nomination.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class ApproveRequest {

    @NotBlank(message = "Coordinator email is required")
    @Email(message = "Coordinator email must be valid")
    private String coordinatorEmail;

    // Internal note from the coordinator. Optional, and distinct from the reason
    // sent to the nominator - this is context for whoever reads the record later.
    private String comment;

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getCoordinatorEmail() {
        return coordinatorEmail;
    }

    public void setCoordinatorEmail(String coordinatorEmail) {
        this.coordinatorEmail = coordinatorEmail;
    }
}
