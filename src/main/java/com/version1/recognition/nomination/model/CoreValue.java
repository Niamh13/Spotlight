package com.version1.recognition.nomination.model;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

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
            "Being truthful, self-aware and open to feedback - including when it is uncomfortable.",
            List.of("honest", "integrity", "truthful", "transparent", "admitted", "owned up")),

    PERSONAL_COMMITMENT(
            "Personal Commitment",
            "Being dependable. Following through on what was promised, without needing to be chased.",
            List.of("commit", "dependable", "reliable", "followed through", "saw it through",
                    "stayed", "stuck with", "picked up", "made sure", "kept going")),

    NO_EGO(
            "No Ego",
            "Putting the outcome ahead of personal credit. Owning mistakes, sharing the win.",
            List.of("ego", "credit", "owned", "own mistake", "shared the", "humble",
                    "stepped back", "gave the credit", "admitted", "without fuss", "quietly")),

    CUSTOMER_FIRST(
            "Customer First",
            "Putting the customer's interests above our own convenience, even when that is the harder call.",
            // Phrases, not bare "customer"/"client" - nearly every nomination
            // mentions a client somewhere, and matching on that alone attributed
            // half of them to this value.
            List.of("customer first", "client first", "put the customer", "put the client",
                    "customer's interests", "client's interests", "best interests",
                    "ahead of our own", "what they needed to hear")),

    EXCELLENCE(
            "Excellence",
            "Leaving no stone unturned. Getting to the root cause rather than the quick fix.",
            List.of("excellence", "root cause", "no stone", "thorough", "rigorous", "quality", "detail")),

    DRIVE(
            "Drive",
            "Energy and determination to make something happen, often without being asked.",
            List.of("drive", "drove", "initiative", "unprompted", "off their own", "pushed",
                    "nobody asked", "no one asked", "wasn't asked", "was not asked",
                    "without being asked", "spotted", "took it on", "volunteered"));

    private final String label;
    private final String prompt;
    private final List<String> keywords;

    CoreValue(String label, String prompt, List<String> keywords) {
        this.label = label;
        this.prompt = prompt;
        this.keywords = keywords;
    }

    /**
     * True if the text visibly touches on this value.
     *
     * <p>A blunt signal: a good write-up can evidence No Ego without ever using
     * the word, so callers treat a "no" as worth mentioning rather than proof of
     * anything. It lives here so the tagging rule and the completeness check
     * ask the question the same way.
     */
    public boolean isEvidencedIn(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        return keywords.stream().anyMatch(lower::contains);
    }

    /**
     * Works out which value a piece of text is claiming, if any.
     *
     * <p>The form asks for the value in prose rather than from a dropdown, so
     * this is how the value still gets recorded for reporting. Naming it outright
     * ("this showed No Ego") wins over a keyword brushing past it, because the
     * name is a deliberate statement and a keyword is a guess.
     *
     * <p>Returns empty when nothing matches, which is itself worth knowing: a
     * write-up that never names a value is exactly what the weak-justification
     * rule is looking for.
     */
    public static Optional<CoreValue> detectIn(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String lower = text.toLowerCase(Locale.ROOT);

        // Named outright - check every value before falling back.
        for (CoreValue value : values()) {
            if (lower.contains(value.namePattern())) {
                return Optional.of(value);
            }
        }
        for (CoreValue value : values()) {
            if (value.isEvidencedIn(lower)) {
                return Optional.of(value);
            }
        }
        return Optional.empty();
    }

    /** The label as it tends to be typed: lower case, "&" spelled out. */
    private String namePattern() {
        return label.toLowerCase(Locale.ROOT).replace(" & ", " and ");
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
