package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.AiFlag;
import com.version1.recognition.nomination.AwardCategory;
import com.version1.recognition.nomination.CoreValue;
import com.version1.recognition.nomination.Nomination;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Manual test plan T-01: A nominates B, then B nominates A -> both should
 * carry a "possible reciprocal" flag. Covers the check in isolation - see
 * 02-e2e-flows.spec.js E2E-6 for the same behavior proven end to end through
 * retag().
 */
class ReciprocalNominationCheckTest {

    private final ReciprocalNominationCheck check = new ReciprocalNominationCheck();

    private Nomination nomination(String nominatorName, String nominatorEmail,
                                   String nomineeName, String nomineeEmail) {
        return new Nomination(
                nominatorName, nominatorEmail, nomineeName, nomineeEmail,
                "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                "What text with enough detail to pass length checks comfortably.",
                "How text with enough detail to pass length checks comfortably.", null);
    }

    @Test
    @DisplayName("flag() returns RECIPROCAL_NOMINATION")
    void flagIsReciprocalNomination() {
        assertThat(check.flag()).isEqualTo(AiFlag.RECIPROCAL_NOMINATION);
    }

    @Nested
    @DisplayName("T-01: A nominates B, B nominates A")
    class ReciprocalPair {

        @Test
        @DisplayName("both directions on record -> the later-evaluated one is flagged, naming the earlier one")
        void bothDirectionsExist_isFlagged() {
            Nomination aNominatesB = nomination("A", "a@example.com", "B", "b@example.com");
            Nomination bNominatesA = nomination("B", "b@example.com", "A", "a@example.com");

            Optional<String> result = check.evaluate(bNominatesA, List.of(aNominatesB, bNominatesA));

            assertThat(result).isPresent();
            assertThat(result.get()).contains("A").contains("also nominated");
        }

        @Test
        @DisplayName("email comparison is case-insensitive and whitespace-tolerant")
        void emailComparison_caseAndWhitespaceInsensitive() {
            Nomination aNominatesB = nomination("A", "  A@Example.com  ", "B", "b@example.com");
            Nomination bNominatesA = nomination("B", "b@example.com", "A", "a@example.com");

            Optional<String> result = check.evaluate(bNominatesA, List.of(aNominatesB, bNominatesA));

            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("only one direction on record -> not flagged")
        void onlyOneDirection_isNotFlagged() {
            Nomination aNominatesB = nomination("A", "a@example.com", "B", "b@example.com");

            Optional<String> result = check.evaluate(aNominatesB, List.of(aNominatesB));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("a nomination never matches itself even when it's the only row in the list")
        void neverMatchesItself() {
            Nomination self = nomination("A", "a@example.com", "B", "b@example.com");

            Optional<String> result = check.evaluate(self, List.of(self));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("an unrelated third-party nomination does not create a false reciprocal match")
        void unrelatedThirdParty_doesNotMatch() {
            Nomination aNominatesB = nomination("A", "a@example.com", "B", "b@example.com");
            Nomination cNominatesD = nomination("C", "c@example.com", "D", "d@example.com");

            Optional<String> result = check.evaluate(aNominatesB, List.of(aNominatesB, cNominatesD));

            assertThat(result).isEmpty();
        }
    }
}
