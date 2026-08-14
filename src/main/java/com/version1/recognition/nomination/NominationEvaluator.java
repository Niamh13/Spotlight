package com.version1.recognition.nomination;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Decides whether a nomination carries enough information to be reviewed.
 * <p>
 * <b>These are deliberately simple text checks, not judgement.</b> Length
 * thresholds and keyword lists are a stand-in until Epic 2's AI tagging lands,
 * at which point this evaluator is the natural place to swap the heuristics for
 * the model's output - the rest of the resubmission flow talks to
 * {@link NominationEvaluation} and doesn't care how the criteria were decided.
 * <p>
 * Because the checks are crude they will produce false positives - a perfectly
 * good nomination that happens not to use any of the impact words below. That
 * is survivable only because nothing here sends anything on its own: a
 * coordinator sees the failing criteria and chooses whether to request a
 * resubmission. Do not wire this directly to an automatic send.
 */
@Service
public class NominationEvaluator {

    /** Below this many characters there isn't enough for a coordinator to judge. */
    static final int MIN_WHAT_LENGTH = 40;
    static final int MIN_HOW_LENGTH = 40;

    /**
     * The Version 1 core values a HOW is expected to name. Matched on stems so
     * "collaborative" and "collaboration" both count.
     */
    private static final List<String> CORE_VALUE_STEMS = List.of(
            "customer success", "customer", "innovat", "collaborat",
            "integrity", "excellen", "communit");

    /**
     * Words that suggest the WHAT describes an outcome rather than just an
     * activity. Crude on purpose - see the class comment.
     */
    private static final List<String> IMPACT_STEMS = List.of(
            "saved", "reduced", "improved", "increased", "delivered", "enabled",
            "unblocked", "prevented", "won", "secured", "grew", "faster",
            "impact", "result", "outcome", "benefit", "client", "customer",
            "revenue", "cost");

    /**
     * A quantified amount - "two days", "40%", "200 hours". Bare time units are
     * deliberately not in {@link #IMPACT_STEMS}: "met every week" is a frequency,
     * not an outcome, and counting it as impact let empty nominations through.
     */
    private static final Pattern QUANTIFIED_IMPACT = Pattern.compile(
            "(\\d+\\s*%)"
                    + "|(\\d+\\s*(hour|day|week|month|year|minute)s?)"
                    + "|((one|two|three|four|five|six|seven|eight|nine|ten|several|many)"
                    + "\\s+(hour|day|week|month|year|minute)s?)",
            Pattern.CASE_INSENSITIVE);

    /** Text that means "I didn't fill this in". */
    private static final List<String> PLACEHOLDERS = List.of(
            "...", "..", "n/a", "na", "tbc", "tbd", "todo", "-", "xxx", "test");

    public NominationEvaluation evaluate(Nomination nomination) {
        List<EvaluationCriterion> failing = new ArrayList<>();

        String what = safe(nomination.getWhatText());
        String how = safe(nomination.getHowText());

        if (what.isEmpty()) {
            failing.add(EvaluationCriterion.WHAT_MISSING);
        } else {
            if (what.length() < MIN_WHAT_LENGTH) {
                failing.add(EvaluationCriterion.WHAT_TOO_BRIEF);
            }
            if (!describesImpact(what)) {
                failing.add(EvaluationCriterion.WHAT_MISSING_IMPACT);
            }
        }

        if (how.isEmpty()) {
            failing.add(EvaluationCriterion.HOW_MISSING);
        } else {
            if (how.length() < MIN_HOW_LENGTH) {
                failing.add(EvaluationCriterion.HOW_TOO_BRIEF);
            }
            if (!containsAny(how, CORE_VALUE_STEMS)) {
                failing.add(EvaluationCriterion.HOW_NO_CORE_VALUE);
            }
        }

        if (isPlaceholder(what) || isPlaceholder(how)) {
            failing.add(EvaluationCriterion.PLACEHOLDER_TEXT);
        }

        return new NominationEvaluation(failing);
    }

    private static String safe(String s) {
        return s == null ? "" : s.trim();
    }

    /** An outcome word, or a quantified amount like "two days" or "40%". */
    private static boolean describesImpact(String what) {
        return containsAny(what, IMPACT_STEMS) || QUANTIFIED_IMPACT.matcher(what).find();
    }

    private static boolean containsAny(String text, List<String> stems) {
        String lower = text.toLowerCase(Locale.ROOT);
        return stems.stream().anyMatch(lower::contains);
    }

    /**
     * True when the whole field is filler. Checked on the entire trimmed value
     * rather than as a substring, so a nomination that legitimately contains
     * "..." mid-sentence isn't flagged.
     */
    private static boolean isPlaceholder(String text) {
        String normalised = text.toLowerCase(Locale.ROOT).replaceAll("[\\s.]+$", "");
        return PLACEHOLDERS.contains(normalised) || PLACEHOLDERS.contains(text.toLowerCase(Locale.ROOT));
    }
}
