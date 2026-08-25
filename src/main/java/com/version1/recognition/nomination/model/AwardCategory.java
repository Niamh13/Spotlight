package com.version1.recognition.nomination.model;

/**
 * The five business categories a Star Award nomination is filed under.
 * <p>
 * Asking the nominator to pick one does two jobs. It makes reporting possible -
 * "top nominations per category per division" needs a category to group by - and
 * it nudges the write-up towards evidence, because each category comes with
 * examples of the kind of measurable impact it expects. A nominator who has
 * picked "Performance &amp; Efficiency" and read "process time reduced, tasks
 * automated" is markedly more likely to include a number than one staring at an
 * empty box.
 * <p>
 * The label and examples live here rather than in the front end so the form, the
 * review queue, the filters and any export all describe a category the same way.
 */
public enum AwardCategory {

    COLLABORATION_AND_ENGAGEMENT(
            "Collaboration & Engagement",
            "Improvements in satisfaction scores, feedback quality, engagement levels."),

    CUSTOMER_IMPACT(
            "Customer Impact",
            "Increased customer satisfaction, response time improvements, retention uplift."),

    INNOVATION_AND_GROWTH(
            "Innovation & Growth",
            "New ideas implemented, blockers removed, scalable solutions introduced."),

    PERFORMANCE_AND_EFFICIENCY(
            "Performance & Efficiency",
            "Process time reduced, tasks automated, increased throughput."),

    QUALITY_AND_COMPLIANCE(
            "Quality & Compliance",
            "Error reduction %, improved accuracy, compliance checks completed.");

    private final String label;
    private final String examples;

    AwardCategory(String label, String examples) {
        this.label = label;
        this.examples = examples;
    }

    /** Display name, e.g. "Customer Impact". */
    public String getLabel() {
        return label;
    }

    /** The kind of evidence this category expects, shown under the picker. */
    public String getExamples() {
        return examples;
    }
}
