package com.version1.recognition.nomination.service;

/**
 * One thing a nomination has to have before a coordinator can reasonably judge
 * it.
 *
 * <p>These are about <em>reviewability</em>, not merit. A nomination can pass
 * every criterion here and still be turned down, and that is the intended
 * separation: completeness is mechanical and can be checked in one click,
 * whereas whether someone deserves an award is a human decision that no rule
 * should be making.
 *
 * <p>Each criterion carries the remedy as well as the test, so a failed check
 * produces something the nominator can act on rather than just a verdict. That
 * text is what gets offered as the send-back message.
 */
public enum CompletenessCriterion {

    WHAT_HAS_DETAIL(
            "The WHAT describes what actually happened",
            "Give enough detail for someone outside the team to understand what was done."),

    WHAT_HAS_IMPACT(
            "The WHAT says what changed as a result",
            "Say who benefited and how - a number, a time saved, or a problem that stopped happening."),

    HOW_HAS_DETAIL(
            "The HOW explains the behaviour, not just the task",
            "Describe how they went about it, not only what was delivered."),

    HOW_NAMES_VALUE(
            "The HOW names a core value",
            "Say which of the six Version 1 core values this shows - Honesty & Integrity, Personal "
                    + "Commitment, No Ego, Customer First, Excellence or Drive - and give an example of it."),

    CATEGORY_SELECTED(
            "A business category is chosen",
            "Pick the category that matches the kind of impact described."),

    NOT_ROUTINE_LANGUAGE(
            "It describes more than routine duties",
            "A Star Award is for going beyond the role. Replace descriptions of normal duties with the "
                    + "thing that was exceptional.");

    private final String label;
    private final String remedy;

    CompletenessCriterion(String label, String remedy) {
        this.label = label;
        this.remedy = remedy;
    }

    /** What is being checked, phrased as the passing state. */
    public String getLabel() {
        return label;
    }

    /** What the nominator should do about it when it fails. */
    public String getRemedy() {
        return remedy;
    }
}
