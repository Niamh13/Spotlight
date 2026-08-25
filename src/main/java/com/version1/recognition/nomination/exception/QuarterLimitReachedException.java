package com.version1.recognition.nomination.exception;

/**
 * Raised when someone tries to submit a second nomination in a quarter they have
 * already nominated in.
 * <p>
 * One per person per quarter, regardless of outcome - a nomination that was
 * rejected or sent back still used that quarter's slot. The exception is a
 * resubmission: a coordinator asked for that one, so it continues the original
 * rather than starting a new entry.
 */
public class QuarterLimitReachedException extends RuntimeException {

    private final String quarterLabel;

    public QuarterLimitReachedException(String message, String quarterLabel) {
        super(message);
        this.quarterLabel = quarterLabel;
    }

    public String getQuarterLabel() {
        return quarterLabel;
    }
}
