package com.version1.recognition.nomination;

import jakarta.validation.constraints.Email;

/**
 * Body for {@code POST /api/nominations/{id}/request-resubmission}.
 * <p>
 * Optional in full - the coordinator's identity comes from the logged-in user
 * once Epic 3 introduces accounts, so it's an explicit field only while there
 * is no auth.
 */
public class RequestResubmissionRequest {

    @Email(message = "Coordinator email must be valid")
    private String coordinatorEmail;

    public String getCoordinatorEmail() {
        return coordinatorEmail;
    }

    public void setCoordinatorEmail(String coordinatorEmail) {
        this.coordinatorEmail = coordinatorEmail;
    }
}
