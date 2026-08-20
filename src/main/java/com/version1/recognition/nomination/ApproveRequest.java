package com.version1.recognition.nomination;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class ApproveRequest {

    @NotBlank(message = "Coordinator email is required")
    @Email(message = "Coordinator email must be valid")
    private String coordinatorEmail;

    public String getCoordinatorEmail() {
        return coordinatorEmail;
    }

    public void setCoordinatorEmail(String coordinatorEmail) {
        this.coordinatorEmail = coordinatorEmail;
    }
}
