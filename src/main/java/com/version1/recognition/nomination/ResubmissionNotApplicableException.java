package com.version1.recognition.nomination;

/**
 * Thrown when a resubmission request doesn't apply to a nomination in its
 * current state - it has already been decided, a request has already gone out,
 * or the evaluation found nothing wrong with it.
 */
public class ResubmissionNotApplicableException extends RuntimeException {

    public ResubmissionNotApplicableException(String message) {
        super(message);
    }
}
