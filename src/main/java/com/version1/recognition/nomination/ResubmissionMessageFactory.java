package com.version1.recognition.nomination;

import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Renders the message the nominator receives.
 * <p>
 * The acceptance criterion "the message lists each failing criterion" lives
 * here: every criterion in the evaluation gets its own numbered entry, with the
 * gap and the remedy on separate lines so it reads as a to-do list rather than
 * a complaint.
 */
@Component
public class ResubmissionMessageFactory {

    public String build(Nomination nomination, NominationEvaluation evaluation) {
        List<EvaluationCriterion> failing = evaluation.getFailingCriteria();
        if (failing.isEmpty()) {
            throw new IllegalArgumentException(
                    "Cannot build a resubmission message for a nomination with no failing criteria");
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(nomination.getNominatorName()).append(",\n\n");
        sb.append("Thanks for nominating ").append(nomination.getNomineeName())
          .append(" for a Star Award. Before it can go to review we need a little more detail.\n\n");

        sb.append(failing.size() == 1
                ? "There is 1 thing to address:\n\n"
                : "There are " + failing.size() + " things to address:\n\n");

        int i = 1;
        for (EvaluationCriterion criterion : failing) {
            sb.append("  ").append(i++).append(". ").append(criterion.getGap()).append("\n");
            sb.append("     What to do: ").append(criterion.getRemedy()).append("\n\n");
        }

        sb.append("Your original wording is below so you can build on it rather than start again.\n\n");
        sb.append("WHAT: ").append(blankToDash(nomination.getWhatText())).append("\n");
        sb.append("HOW:  ").append(blankToDash(nomination.getHowText())).append("\n\n");

        sb.append("To resubmit, send a new nomination quoting this one's reference as ")
          .append("originalNominationId so the two stay linked.\n\n");
        sb.append("Reference: ").append(nomination.getId()).append("\n");

        return sb.toString();
    }

    private static String blankToDash(String s) {
        return (s == null || s.isBlank()) ? "(not provided)" : s.trim();
    }
}
