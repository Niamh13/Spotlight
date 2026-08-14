package com.version1.recognition.nomination;

/**
 * The criteria a nomination is evaluated against for completeness.
 * <p>
 * Each constant carries the two halves the resubmission message needs: the
 * {@code gap} (what is wrong) and the {@code remedy} (what the nominator should
 * do about it). Keeping both on the enum is what lets the message list every
 * failing criterion without a separate lookup table of wording.
 * <p>
 * The MISSING_ constants cannot currently be produced through
 * {@code POST /api/nominations}, because {@code @NotBlank} on
 * {@link NominationRequest} rejects blank text before it reaches the evaluator.
 * They are here anyway so the evaluator is correct on its own terms rather than
 * relying on a particular caller having validated first.
 */
public enum EvaluationCriterion {

    WHAT_MISSING(
            "No WHAT was provided.",
            "Describe the achievement, contribution or action being recognised."),

    WHAT_TOO_BRIEF(
            "The WHAT is too brief to review.",
            "Give enough detail for a coordinator to understand what actually happened."),

    WHAT_MISSING_IMPACT(
            "The WHAT doesn't say what the impact was.",
            "Say who benefited, or what changed as a result."),

    HOW_MISSING(
            "No HOW was provided.",
            "Explain how this demonstrated a Version 1 core value."),

    HOW_TOO_BRIEF(
            "The HOW is too brief to review.",
            "Expand on how the behaviour demonstrated the value, not just what was done."),

    HOW_NO_CORE_VALUE(
            "The HOW doesn't name a Version 1 core value.",
            "Name the core value demonstrated - Customer Success, Innovation, Collaboration, "
                    + "Integrity, Excellence or Community."),

    PLACEHOLDER_TEXT(
            "The nomination contains placeholder text rather than real detail.",
            "Replace filler such as \"...\", \"n/a\" or \"TBC\" with the actual detail.");

    private final String gap;
    private final String remedy;

    EvaluationCriterion(String gap, String remedy) {
        this.gap = gap;
        this.remedy = remedy;
    }

    /** What is wrong with the nomination. */
    public String getGap() {
        return gap;
    }

    /** What the nominator needs to do to fix it. */
    public String getRemedy() {
        return remedy;
    }
}
