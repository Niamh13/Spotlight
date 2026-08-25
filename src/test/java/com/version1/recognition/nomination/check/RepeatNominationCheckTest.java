package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.AwardCategory;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.Quarter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Manual test plan T-03: the same nominee also nominated in the immediately
 * preceding quarter should be flagged. Nomination.submittedAt has no public
 * setter (it's stamped from Instant.now() in the constructor), so backdated
 * fixtures here use ReflectionTestUtils rather than a test-only setter added
 * to production code just for this.
 */
class RepeatNominationCheckTest {

    private final RepeatNominationCheck check = new RepeatNominationCheck();

    private Nomination nomination(String nominatorName, String nominatorEmail,
                                   String nomineeName, String nomineeEmail) {
        return new Nomination(
                nominatorName, nominatorEmail, nomineeName, nomineeEmail,
                "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                "What text with enough detail to pass length checks comfortably.",
                "How text with enough detail to pass length checks comfortably.", null);
    }

    private void backdateTo(Nomination nomination, Instant submittedAt) {
        ReflectionTestUtils.setField(nomination, "submittedAt", submittedAt);
    }

    @Test
    @DisplayName("flag() returns REPEAT_NOMINATION_CONSECUTIVE_QUARTER")
    void flagIsRepeatNomination() {
        assertThat(check.flag()).isEqualTo(AiFlag.REPEAT_NOMINATION_CONSECUTIVE_QUARTER);
    }

    @Nested
    @DisplayName("T-03: nominee also nominated last quarter")
    class ConsecutiveQuarter {

        @Test
        @DisplayName("same nominee, immediately preceding quarter, different nominator -> flagged")
        void immediatelyPrecedingQuarter_isFlagged() {
            Nomination current = nomination("New Nominator", "new@example.com", "Nominee", "nominee@example.com");
            Nomination previous = nomination("Old Nominator", "old@example.com", "Nominee", "nominee@example.com");
            backdateTo(previous, Quarter.current().previous().start());

            Optional<String> result = check.evaluate(current, List.of(current, previous));

            assertThat(result).isPresent();
            assertThat(result.get()).contains("Old Nominator");
        }

        @Test
        @DisplayName("same nominee, TWO quarters back (not immediately preceding) -> not flagged")
        void twoQuartersBack_isNotFlagged() {
            Nomination current = nomination("New Nominator", "new@example.com", "Nominee", "nominee@example.com");
            Nomination twoBack = nomination("Old Nominator", "old@example.com", "Nominee", "nominee@example.com");
            backdateTo(twoBack, Quarter.current().previous().previous().start());

            Optional<String> result = check.evaluate(current, List.of(current, twoBack));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("same nominee, same (current) quarter, different nominator -> not flagged - this check is "
                + "about consecutive quarters, not duplicate nominees within one quarter")
        void sameQuarter_isNotFlagged() {
            Nomination current = nomination("New Nominator", "new@example.com", "Nominee", "nominee@example.com");
            Nomination alsoThisQuarter = nomination(
                    "Other Nominator", "other@example.com", "Nominee", "nominee@example.com");

            Optional<String> result = check.evaluate(current, List.of(current, alsoThisQuarter));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("different nominee in the preceding quarter -> not flagged")
        void differentNominee_isNotFlagged() {
            Nomination current = nomination("New Nominator", "new@example.com", "Nominee", "nominee@example.com");
            Nomination previous = nomination(
                    "Old Nominator", "old@example.com", "Someone Else", "else@example.com");
            backdateTo(previous, Quarter.current().previous().start());

            Optional<String> result = check.evaluate(current, List.of(current, previous));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("a nomination never matches itself as its own preceding-quarter record")
        void neverMatchesItself() {
            Nomination current = nomination("New Nominator", "new@example.com", "Nominee", "nominee@example.com");

            Optional<String> result = check.evaluate(current, List.of(current));

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("null-safety")
    class NullSafety {

        @Test
        @DisplayName("null submittedAt on the nomination being evaluated does not throw")
        void nullSubmittedAt_doesNotThrow() {
            Nomination current = nomination("New Nominator", "new@example.com", "Nominee", "nominee@example.com");
            backdateTo(current, null);

            Optional<String> result = check.evaluate(current, List.of(current));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("null nomineeEmail on the nomination being evaluated does not throw")
        void nullNomineeEmail_doesNotThrow() {
            Nomination current = nomination("New Nominator", "new@example.com", "Nominee", null);

            Optional<String> result = check.evaluate(current, List.of(current));

            assertThat(result).isEmpty();
        }
    }
}
