package com.version1.recognition.nomination;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NominationEvaluatorTest {

    private final NominationEvaluator evaluator = new NominationEvaluator();

    private static Nomination nomination(String what, String how) {
        return new Nomination("Jamie Doyle", "jamie.doyle@version1.com",
                "Alex Rivera", "alex.rivera@version1.com",
                "Cloud Engineering", "Dublin", what, how, null);
    }

    @Test
    void passesWhenBothSectionsAreSubstantial() {
        NominationEvaluation result = evaluator.evaluate(nomination(
                "Led the release rollout over a tight weekend and saved the client two days of downtime.",
                "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure."));

        assertThat(result.isComplete()).isTrue();
        assertThat(result.flagsIncompleteInformation()).isFalse();
        assertThat(result.getFailingCriteria()).isEmpty();
    }

    @Test
    void flagsShortWhat() {
        NominationEvaluation result = evaluator.evaluate(nomination(
                "Helped the client.",
                "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure."));

        assertThat(result.getFailingCriteria()).contains(EvaluationCriterion.WHAT_TOO_BRIEF);
    }

    @Test
    void flagsWhatWithNoStatedImpact() {
        NominationEvaluation result = evaluator.evaluate(nomination(
                "Attended the workshops and joined the planning sessions every single week.",
                "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure."));

        assertThat(result.getFailingCriteria()).contains(EvaluationCriterion.WHAT_MISSING_IMPACT);
    }

    @Test
    void countsAQuantifiedAmountAsImpact() {
        NominationEvaluation result = evaluator.evaluate(nomination(
                "Rewrote the nightly batch so it finishes in two hours rather than overnight.",
                "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure."));

        assertThat(result.getFailingCriteria()).doesNotContain(EvaluationCriterion.WHAT_MISSING_IMPACT);
    }

    @Test
    void doesNotCountABareTimeUnitAsImpact() {
        // "every week" is a frequency, not an outcome.
        NominationEvaluation result = evaluator.evaluate(nomination(
                "Ran the internal community sessions every week for the whole of the last quarter.",
                "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure."));

        assertThat(result.getFailingCriteria()).contains(EvaluationCriterion.WHAT_MISSING_IMPACT);
    }

    @Test
    void flagsHowThatNamesNoCoreValue() {
        NominationEvaluation result = evaluator.evaluate(nomination(
                "Led the release rollout over a tight weekend and saved the client two days of downtime.",
                "Stayed late every evening and kept on going until the whole thing was finished."));

        assertThat(result.getFailingCriteria()).contains(EvaluationCriterion.HOW_NO_CORE_VALUE);
    }

    @Test
    void flagsPlaceholderText() {
        NominationEvaluation result = evaluator.evaluate(nomination("...", "n/a"));

        assertThat(result.getFailingCriteria()).contains(EvaluationCriterion.PLACEHOLDER_TEXT);
    }

    @Test
    void doesNotFlagEllipsisUsedMidSentence() {
        NominationEvaluation result = evaluator.evaluate(nomination(
                "Led the rollout... and saved the client two full days of downtime in the process.",
                "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure."));

        assertThat(result.getFailingCriteria()).doesNotContain(EvaluationCriterion.PLACEHOLDER_TEXT);
    }

    @Test
    void flagsEveryFailureNotJustTheFirst() {
        NominationEvaluation result = evaluator.evaluate(nomination("Did stuff.", "Was good."));

        assertThat(result.getFailingCriteria()).contains(
                EvaluationCriterion.WHAT_TOO_BRIEF,
                EvaluationCriterion.WHAT_MISSING_IMPACT,
                EvaluationCriterion.HOW_TOO_BRIEF,
                EvaluationCriterion.HOW_NO_CORE_VALUE);
    }
}
