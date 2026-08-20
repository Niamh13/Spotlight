package com.version1.recognition.nomination;

/**
 * Version 1's six core values.
 *
 * <p>These replace the six placeholder values the earlier prototype carried
 * (Customer Success, Innovation, Collaboration, Integrity, Excellence,
 * Community), which were invented rather than looked up. Nominations are
 * assessed against the real values, so the form has to offer the real ones.
 *
 * <p>The {@code prompt} on each is guidance written for this form - what
 * evidencing that value tends to look like in a nomination. It is not official
 * company copy, and is phrased to help a nominator write a specific HOW rather
 * than to define the value itself.
 */
public enum CoreValue {

    HONESTY_AND_INTEGRITY(
            "Honesty & Integrity",
            "Being truthful, self-aware and open to feedback - including when it is uncomfortable."),

    PERSONAL_COMMITMENT(
            "Personal Commitment",
            "Being dependable. Following through on what was promised, without needing to be chased."),

    NO_EGO(
            "No Ego",
            "Putting the outcome ahead of personal credit. Owning mistakes, sharing the win."),

    CUSTOMER_FIRST(
            "Customer First",
            "Putting the customer's interests above our own convenience, even when that is the harder call."),

    EXCELLENCE(
            "Excellence",
            "Leaving no stone unturned. Getting to the root cause rather than the quick fix."),

    DRIVE(
            "Drive",
            "Energy and determination to make something happen, often without being asked.");

    private final String label;
    private final String prompt;

    CoreValue(String label, String prompt) {
        this.label = label;
        this.prompt = prompt;
    }

    /** Display name, e.g. "No Ego". */
    public String getLabel() {
        return label;
    }

    /** What evidencing this value tends to look like, shown under the picker. */
    public String getPrompt() {
        return prompt;
    }
}
