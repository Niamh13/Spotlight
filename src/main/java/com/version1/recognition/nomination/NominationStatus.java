package com.version1.recognition.nomination;

public enum NominationStatus {
    PENDING_REVIEW,
    /**
     * Evaluation found missing or insufficient information and a request to
     * complete it has gone to the nominator. Deliberately distinct from
     * REJECTED: "we need more detail" and "this didn't meet the bar" mean
     * different things to the nominator and report differently on the dashboard.
     */
    RESUBMISSION_REQUESTED,
    APPROVED,
    REJECTED
}
