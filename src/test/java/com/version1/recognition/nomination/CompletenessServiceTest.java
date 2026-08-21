package com.version1.recognition.nomination;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CompletenessServiceTest {

    private final CompletenessService service = new CompletenessService();

    private Nomination nomination(String what, String how, CoreValue coreValue, AwardCategory category) {
        return new Nomination(
                "Nominator", "nominator@example.com", "Nominee", "nominee@example.com",
                "Practice", "Location", category, coreValue, what, how, null);
    }

    @Nested
    @DisplayName("WHAT_HAS_DETAIL (80 char threshold)")
    class WhatHasDetail {

        @Test
        @DisplayName("exactly 80 chars passes")
        void exactly80CharsPasses() {
            Nomination n = nomination("x".repeat(80), "irrelevant", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.WHAT_HAS_DETAIL)).isTrue();
        }

        @Test
        @DisplayName("79 chars fails")
        void seventyNineCharsFails() {
            Nomination n = nomination("x".repeat(79), "irrelevant", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.WHAT_HAS_DETAIL)).isFalse();
        }
    }

    @Nested
    @DisplayName("HOW_HAS_DETAIL (60 char threshold)")
    class HowHasDetail {

        @Test
        @DisplayName("exactly 60 chars passes")
        void exactly60CharsPasses() {
            Nomination n = nomination("irrelevant", "x".repeat(60), null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.HOW_HAS_DETAIL)).isTrue();
        }

        @Test
        @DisplayName("59 chars fails")
        void fiftyNineCharsFails() {
            Nomination n = nomination("irrelevant", "x".repeat(59), null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.HOW_HAS_DETAIL)).isFalse();
        }
    }

    @Nested
    @DisplayName("WHAT_HAS_IMPACT - figure or impact-word evidence")
    class WhatHasImpact {

        @Test
        @DisplayName("a plain digit counts as impact evidence")
        void digitCountsAsImpact() {
            Nomination n = nomination("Cut onboarding time by 30%.", "irrelevant", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.WHAT_HAS_IMPACT)).isTrue();
        }

        @Test
        @DisplayName("regression: an impact word with no digits at all must still count as impact")
        void impactWordWithoutDigits_stillCounts() {
            // Pins down the exact bug the class javadoc describes: an earlier
            // substring-match version missed this sentence entirely because it
            // only looked for "cut " and there is no digit anywhere in it.
            Nomination n = nomination(
                    "Rebuilt the release pipeline over a weekend, cutting a five-day manual "
                            + "process to under four hours.",
                    "irrelevant", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.WHAT_HAS_IMPACT)).isTrue();
        }

        @Test
        @DisplayName("no digit and no impact word - fails")
        void noDigitNoImpactWord_fails() {
            Nomination n = nomination("Did a good job on the project.", "irrelevant", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.WHAT_HAS_IMPACT)).isFalse();
        }
    }

    @Nested
    @DisplayName("VALUE_SELECTED / HOW_EVIDENCES_VALUE")
    class ValueCriteria {

        @Test
        @DisplayName("no core value selected fails both VALUE_SELECTED and HOW_EVIDENCES_VALUE")
        void noValueSelected_failsBoth() {
            Nomination n = nomination("What text.", "How text.", null, null);

            Map<CompletenessCriterion, Boolean> assessed = service.assess(n);

            assertThat(assessed.get(CompletenessCriterion.VALUE_SELECTED)).isFalse();
            assertThat(assessed.get(CompletenessCriterion.HOW_EVIDENCES_VALUE)).isFalse();
        }

        @Test
        @DisplayName("value selected and evidenced via WHAT, not just HOW - both pass")
        void valueSelectedAndEvidencedInWhat_bothPass() {
            // The service reads WHAT + HOW combined for evidence, not HOW alone -
            // nominators often name the value in the WHAT.
            Nomination n = nomination(
                    "They showed real drive by taking on the migration without being asked.",
                    "How text with no value keyword here.",
                    CoreValue.DRIVE, null);

            Map<CompletenessCriterion, Boolean> assessed = service.assess(n);

            assertThat(assessed.get(CompletenessCriterion.VALUE_SELECTED)).isTrue();
            assertThat(assessed.get(CompletenessCriterion.HOW_EVIDENCES_VALUE)).isTrue();
        }

        @Test
        @DisplayName("value selected but not evidenced anywhere - VALUE_SELECTED passes, HOW_EVIDENCES_VALUE fails")
        void valueSelectedNotEvidenced() {
            Nomination n = nomination("Neutral text.", "Also neutral.", CoreValue.CUSTOMER_FIRST, null);

            Map<CompletenessCriterion, Boolean> assessed = service.assess(n);

            assertThat(assessed.get(CompletenessCriterion.VALUE_SELECTED)).isTrue();
            assertThat(assessed.get(CompletenessCriterion.HOW_EVIDENCES_VALUE)).isFalse();
        }
    }

    @Nested
    @DisplayName("CATEGORY_SELECTED")
    class CategorySelected {

        @Test
        @DisplayName("null category fails")
        void nullCategoryFails() {
            Nomination n = nomination("What.", "How.", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.CATEGORY_SELECTED)).isFalse();
        }

        @Test
        @DisplayName("category present passes")
        void categoryPresentPasses() {
            Nomination n = nomination("What.", "How.", null, AwardCategory.CUSTOMER_IMPACT);

            assertThat(service.assess(n).get(CompletenessCriterion.CATEGORY_SELECTED)).isTrue();
        }
    }

    @Nested
    @DisplayName("NOT_ROUTINE_LANGUAGE")
    class NotRoutineLanguage {

        @Test
        @DisplayName("a known routine phrase fails this criterion")
        void routinePhraseFails() {
            Nomination n = nomination("They completed on time.", "As always.", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.NOT_ROUTINE_LANGUAGE)).isFalse();
        }

        @Test
        @DisplayName("no routine phrase passes")
        void noRoutinePhrasePasses() {
            Nomination n = nomination("They redesigned the deployment pipeline from scratch.",
                    "By mapping every failure mode themselves.", null, null);

            assertThat(service.assess(n).get(CompletenessCriterion.NOT_ROUTINE_LANGUAGE)).isTrue();
        }
    }

    @Nested
    @DisplayName("failing() and toResubmissionMessage()")
    class FailingAndMessage {

        @Test
        @DisplayName("a fully complete nomination has no failing criteria and an empty message")
        void fullyComplete_noFailuresEmptyMessage() {
            Nomination n = nomination(
                    "They redesigned the deployment pipeline from scratch, cutting release time "
                            + "from two days down to twenty minutes for the whole team.",
                    "They showed real drive, mapping every failure mode themselves without "
                            + "being asked and fixing each one before it caused an incident.",
                    CoreValue.DRIVE, AwardCategory.INNOVATION_AND_GROWTH);

            assertThat(service.failing(n)).isEmpty();
            assertThat(service.toResubmissionMessage(n)).isEmpty();
        }

        @Test
        @DisplayName("exactly one failing criterion - message uses singular \"one thing\"")
        void oneFailure_singularWording() {
            // Everything passes except CATEGORY_SELECTED.
            Nomination n = nomination(
                    "They redesigned the deployment pipeline from scratch, cutting release time "
                            + "from two days down to twenty minutes for the whole team.",
                    "They showed real drive, mapping every failure mode themselves without "
                            + "being asked and fixing each one before it caused an incident.",
                    CoreValue.DRIVE, null);

            assertThat(service.failing(n)).containsExactly(CompletenessCriterion.CATEGORY_SELECTED);
            assertThat(service.toResubmissionMessage(n)).contains("there is one thing");
        }

        @Test
        @DisplayName("multiple failing criteria - message uses plural \"N things\" and lists each one")
        void multipleFailures_pluralWordingAndListsEach() {
            Nomination n = nomination("Short.", "Also short.", null, null);

            var failing = service.failing(n);
            String message = service.toResubmissionMessage(n);

            assertThat(failing.size()).isGreaterThan(1);
            assertThat(message).contains("are " + failing.size() + " things");
            for (CompletenessCriterion criterion : failing) {
                assertThat(message).contains(criterion.getLabel());
                assertThat(message).contains(criterion.getRemedy());
            }
        }

        @Test
        @DisplayName("failing() follows assess()'s insertion order, not CompletenessCriterion's declaration order")
        void failingFollowsAssessInsertionOrder() {
            // assess() inserts VALUE_SELECTED before HOW_EVIDENCES_VALUE into its
            // LinkedHashMap, but the enum itself declares HOW_EVIDENCES_VALUE
            // first - failing() follows the map's insertion order (i.e. assess()'s
            // code order), which happens to differ from the enum's declared order
            // at exactly this one pair. Pinned here so that either an assess()
            // reorder or an enum reorder shows up as a visible test change.
            Nomination n = nomination("Short.", "Also short.", null, null);

            assertThat(service.failing(n)).containsExactly(
                    CompletenessCriterion.WHAT_HAS_DETAIL,
                    CompletenessCriterion.WHAT_HAS_IMPACT,
                    CompletenessCriterion.HOW_HAS_DETAIL,
                    CompletenessCriterion.VALUE_SELECTED,
                    CompletenessCriterion.HOW_EVIDENCES_VALUE,
                    CompletenessCriterion.CATEGORY_SELECTED);
        }
    }
}
