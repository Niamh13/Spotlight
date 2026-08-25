package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.AwardCategory;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.Nomination;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the "2 of 3 signals" threshold in WeakJustificationCheck: short text,
 * no figures, and no evidenced core value. Only two-or-more failing should
 * raise the flag - one alone has honest exceptions per the class javadoc.
 */
class WeakJustificationCheckTest {

    private final WeakJustificationCheck check = new WeakJustificationCheck();

    private Nomination nomination(String what, String how, CoreValue coreValue) {
        return new Nomination(
                "Nominator", "nominator@example.com", "Nominee", "nominee@example.com",
                "Practice", "Location", AwardCategory.QUALITY_AND_COMPLIANCE,
                coreValue, what, how, null);
    }

    @Test
    @DisplayName("flag() returns WEAK_JUSTIFICATION")
    void flagIsWeakJustification() {
        assertThat(check.flag()).isEqualTo(AiFlag.WEAK_JUSTIFICATION);
    }

    @Nested
    @DisplayName("length threshold (150 chars, WHAT + HOW combined)")
    class LengthThreshold {

        // Base phrase is 59 chars, contains a digit ("5%") and evidences DRIVE
        // ("without being asked"). Padded with 'x' so only the length signal
        // moves between the two cases - everything else stays constant.
        private static final String BASE = "5% improvement achieved without being asked to do it at all";

        @Test
        @DisplayName("exactly 150 combined chars is NOT short - passes that signal, so nothing flags")
        void combinedLength150_isNotShort() {
            String what = "x".repeat(60);
            String how = BASE + "x".repeat(30);
            assertThat((what + " " + how)).hasSize(150);

            Nomination n = nomination(what, how, CoreValue.DRIVE);

            assertThat(check.evaluate(n, Collections.emptyList())).isEmpty();
        }

        @Test
        @DisplayName("149 combined chars is short, but alone is not enough to flag (need 2 of 3)")
        void combinedLength149_isShort_butAloneIsNotEnough() {
            String what = "x".repeat(60);
            String how = BASE + "x".repeat(29);
            assertThat((what + " " + how)).hasSize(149);

            Nomination n = nomination(what, how, CoreValue.DRIVE);

            assertThat(check.evaluate(n, Collections.emptyList())).isEmpty();
        }
    }

    @Nested
    @DisplayName("two of three signals")
    class TwoOfThree {

        @Test
        @DisplayName("short AND no figures AND no value selected -> flagged, all 3 signals fail")
        void allThreeFail_isFlagged() {
            Nomination n = nomination("Did a good job.", "Was helpful.", null);

            Optional<String> result = check.evaluate(n, Collections.emptyList());

            assertThat(result).isPresent();
            assertThat(result.get()).contains("Thin on 3 of 3 signals");
        }

        @Test
        @DisplayName("short AND no core value, but has a figure -> still flagged (2 of 3)")
        void shortAndNoValue_withFigure_isFlagged() {
            Nomination n = nomination("Saved 5 hours.", "Quick fix.", null);

            Optional<String> result = check.evaluate(n, Collections.emptyList());

            assertThat(result).isPresent();
            assertThat(result.get()).contains("Thin on 2 of 3 signals");
        }

        @Test
        @DisplayName("only one signal failing (no figures) -> NOT flagged")
        void onlyOneSignalFailing_isNotFlagged() {
            String longText = "This nomination is written with plenty of detail so it clears "
                    + "the length threshold comfortably on its own words alone without needing any padding.";
            Nomination n = nomination(longText, "They showed real drive and were never asked to help out.",
                    CoreValue.DRIVE);

            Optional<String> result = check.evaluate(n, Collections.emptyList());

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("no core value named or evidenced anywhere in the text -> counts as a failing signal")
        void noValueNamedOrEvidenced_countsAsFailure() {
            // The coreValue field is no longer read here - the check looks at the
            // text itself. No CUSTOMER_FIRST/client keywords anywhere, and short -
            // two signals.
            Nomination n = nomination("Did a task.", "Finished it.", CoreValue.CUSTOMER_FIRST);

            Optional<String> result = check.evaluate(n, Collections.emptyList());

            assertThat(result).isPresent();
            assertThat(result.get()).contains("names none of the six core values");
        }
    }

    @Nested
    @DisplayName("null-safety")
    class NullSafety {

        @Test
        @DisplayName("null WHAT/HOW text does not throw, and counts as short + no figures")
        void nullTextDoesNotThrow() {
            Nomination n = nomination(null, null, null);

            Optional<String> result = check.evaluate(n, Collections.emptyList());

            assertThat(result).isPresent();
        }
    }

    @Test
    @DisplayName("other nominations passed in allNominations are ignored - this check is per-nomination")
    void ignoresOtherNominationsInList() {
        Nomination n = nomination("Did a good job.", "Was helpful.", null);
        List<Nomination> all = List.of(n, nomination("Great long detailed writeup with figures like 42%.",
                "Showed real commitment and followed through as promised.", CoreValue.PERSONAL_COMMITMENT));

        Optional<String> result = check.evaluate(n, all);

        assertThat(result).isPresent();
    }
}
