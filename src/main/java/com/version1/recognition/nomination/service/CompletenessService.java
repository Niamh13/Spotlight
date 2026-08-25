package com.version1.recognition.nomination.service;

import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.Nomination;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * The one-click completeness check.
 *
 * <p>Answers a single question for a coordinator: <em>is there enough here to
 * make a decision?</em> Every criterion is a mechanical test on the text and the
 * fields, so the answer is instant, repeatable, and identical for two
 * coordinators looking at the same nomination - which is the point. It is
 * deliberately not a judgement about whether the nominee deserves an award.
 *
 * <p>It overlaps with the AI score on purpose, and they are not
 * interchangeable. The score is a model's opinion, useful for ordering a queue.
 * This is a checklist that always gives the same answer and, more usefully,
 * produces the text to send back when something is missing - so "this is thin"
 * turns into a specific request in one click rather than a paragraph the
 * coordinator has to write themselves.
 */
@Service
public class CompletenessService {

    private static final int WHAT_MIN_CHARS = 80;
    private static final int HOW_MIN_CHARS = 60;

    private static final Pattern HAS_FIGURE = Pattern.compile("\\d");

    /**
     * Words describing a consequence, for nominations that state impact without
     * a number. Matched on word boundaries with common endings allowed - an
     * earlier version used plain substring matching against "cut ", which missed
     * "cutting a five-day process to four hours" and marked one of the strongest
     * nominations as having no stated impact.
     */
    private static final Pattern IMPACT_WORDS = Pattern.compile(
            "\\b(saved?|saving|reduc(e|ed|ing|tion)|cut|cutting|increas(e|ed|ing)"
            + "|improv(e|ed|ing|ement)|prevent(ed|ing)?|avoid(ed|ing)?|eliminat(e|ed|ing)"
            + "|meant|resulted|result|enabl(e|ed|ing)|unblock(ed|ing)?|freed|halv(e|ed|ing)"
            + "|turned around|recover(ed|ing)?|retain(ed|ing)?|benefit(ed|ted)?|so that"
            + "|as a result|down to|up from)\\b",
            Pattern.CASE_INSENSITIVE);

    /** Routine-duty phrasing, kept in step with RoutineLanguageCheck. */
    private static final List<String> ROUTINE_PHRASES = List.of(
            "completed on time", "completed the task", "attended", "showed up",
            "responded to emails", "closed tickets", "did their job", "met the deadline",
            "always available", "always helpful", "team player", "good job", "nice work",
            "hard worker", "works hard");

    /**
     * Runs every criterion against one nomination.
     *
     * @return a map preserving criterion order, each entry saying whether it
     *         passed. Callers that only care about failures can filter it.
     */
    public Map<CompletenessCriterion, Boolean> assess(Nomination nomination) {
        String what = nomination.getWhatText() == null ? "" : nomination.getWhatText().trim();
        String how = nomination.getHowText() == null ? "" : nomination.getHowText().trim();
        String combinedLower = (what + " " + how).toLowerCase(Locale.ROOT);

        Map<CompletenessCriterion, Boolean> results = new LinkedHashMap<>();

        results.put(CompletenessCriterion.WHAT_HAS_DETAIL, what.length() >= WHAT_MIN_CHARS);

        // A figure is the clearest evidence of impact, but plenty of real impact
        // has no number attached - "meant the client stopped escalating" is a
        // consequence. Accept either rather than demanding arithmetic.
        boolean statesImpact = HAS_FIGURE.matcher(what).find()
                || IMPACT_WORDS.matcher(what).find();
        results.put(CompletenessCriterion.WHAT_HAS_IMPACT, statesImpact);

        results.put(CompletenessCriterion.HOW_HAS_DETAIL, how.length() >= HOW_MIN_CHARS);

        // The HOW only, deliberately. Reading the WHAT as well made this pass on
        // a nomination whose HOW named nothing, because the WHAT happened to
        // mention a client - and it disagreed with the value actually recorded,
        // which is read from the HOW. One question, one field.
        results.put(CompletenessCriterion.HOW_NAMES_VALUE,
                CoreValue.detectIn(how).isPresent());

        results.put(CompletenessCriterion.CATEGORY_SELECTED, nomination.getCategory() != null);

        results.put(CompletenessCriterion.NOT_ROUTINE_LANGUAGE,
                ROUTINE_PHRASES.stream().noneMatch(combinedLower::contains));

        return results;
    }

    /** The criteria that failed, in declaration order. */
    public List<CompletenessCriterion> failing(Nomination nomination) {
        List<CompletenessCriterion> failed = new ArrayList<>();
        assess(nomination).forEach((criterion, passed) -> {
            if (!passed) {
                failed.add(criterion);
            }
        });
        return failed;
    }

    /**
     * A ready-to-send message listing what is missing and what to do about it.
     *
     * <p>This is the actual value of the check. Writing "please add more detail"
     * by hand is vague and takes a minute; this is specific, consistent between
     * coordinators, and takes one click. The coordinator can edit it before
     * sending - it is a starting point, not a decision.
     */
    public String toResubmissionMessage(Nomination nomination) {
        List<CompletenessCriterion> failed = failing(nomination);
        if (failed.isEmpty()) {
            return "";
        }

        StringBuilder message = new StringBuilder();
        message.append("Before this can go to review, there ");
        message.append(failed.size() == 1 ? "is one thing" : "are " + failed.size() + " things");
        message.append(" to add:\n\n");

        int n = 1;
        for (CompletenessCriterion criterion : failed) {
            message.append(n++).append(". ").append(criterion.getLabel()).append("\n");
            message.append("   ").append(criterion.getRemedy()).append("\n\n");
        }

        message.append("Your original wording is kept, so you can build on it rather than "
                + "start again.");
        return message.toString();
    }
}
