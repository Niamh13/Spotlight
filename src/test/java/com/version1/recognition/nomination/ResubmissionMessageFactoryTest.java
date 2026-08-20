package com.version1.recognition.nomination;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Covers the acceptance criterion "the message lists each failing criterion".
 */
class ResubmissionMessageFactoryTest {

    private final ResubmissionMessageFactory factory = new ResubmissionMessageFactory();

    private static Nomination nomination() {
        return new Nomination("Jamie Doyle", "jamie.doyle@version1.com",
                "Alex Rivera", "alex.rivera@version1.com",
                "Cloud Engineering", "Dublin", "Did stuff.", "Was good.", null);
    }

    @Test
    void listsEveryFailingCriterion() {
        List<EvaluationCriterion> failing = List.of(
                EvaluationCriterion.WHAT_TOO_BRIEF,
                EvaluationCriterion.WHAT_MISSING_IMPACT,
                EvaluationCriterion.HOW_NO_CORE_VALUE);

        String message = factory.build(nomination(), new NominationEvaluation(failing));

        // Every criterion appears, with both its gap and what to do about it.
        for (EvaluationCriterion criterion : failing) {
            assertThat(message).contains(criterion.getGap());
            assertThat(message).contains(criterion.getRemedy());
        }
        assertThat(message).contains("There are 3 things to address:");
        assertThat(message).contains("1. ").contains("2. ").contains("3. ");
    }

    @Test
    void namesBothPeopleAndQuotesTheOriginalWording() {
        String message = factory.build(nomination(),
                new NominationEvaluation(List.of(EvaluationCriterion.HOW_TOO_BRIEF)));

        assertThat(message).contains("Hi Jamie Doyle,");
        assertThat(message).contains("Alex Rivera");
        assertThat(message).contains("WHAT: Did stuff.");
        assertThat(message).contains("HOW:  Was good.");
    }

    @Test
    void usesSingularWordingForOneCriterion() {
        String message = factory.build(nomination(),
                new NominationEvaluation(List.of(EvaluationCriterion.HOW_TOO_BRIEF)));

        assertThat(message).contains("There is 1 thing to address:");
    }

    @Test
    void refusesToBuildAMessageWithNothingToSay() {
        assertThatThrownBy(() -> factory.build(nomination(), NominationEvaluation.complete()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
