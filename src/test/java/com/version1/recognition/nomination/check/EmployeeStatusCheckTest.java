package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.AiFlag;
import com.version1.recognition.nomination.AwardCategory;
import com.version1.recognition.nomination.CoreValue;
import com.version1.recognition.nomination.Nomination;
import com.version1.recognition.nomination.Role;
import com.version1.recognition.nomination.User;
import com.version1.recognition.nomination.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unlike the other checks in this package, this one has a real dependency
 * (UserRepository) now that it's backed by a real user directory rather than
 * being a permanent no-op - so, unlike WeakJustificationCheckTest/
 * RoutineLanguageCheckTest, this is Mockito-based.
 */
@ExtendWith(MockitoExtension.class)
class EmployeeStatusCheckTest {

    @Mock
    private UserRepository userRepository;

    private EmployeeStatusCheck check;

    @BeforeEach
    void setUp() {
        check = new EmployeeStatusCheck(userRepository);
    }

    private Nomination nomination(String nomineeEmail) {
        return new Nomination(
                "Nominator", "nominator@example.com", "Nominee", nomineeEmail,
                "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                "What text with enough detail to pass length checks comfortably.",
                "How text with enough detail to pass length checks comfortably.", null);
    }

    @Test
    @DisplayName("flag() returns NOMINEE_NOT_ACTIVE_EMPLOYEE")
    void flagIsNomineeNotActiveEmployee() {
        assertThat(check.flag()).isEqualTo(AiFlag.NOMINEE_NOT_ACTIVE_EMPLOYEE);
    }

    @Nested
    @DisplayName("known nominee")
    class KnownNominee {

        @Test
        @DisplayName("nominee found in the directory -> no flag")
        void nomineeFound_noFlag() {
            when(userRepository.findByEmailIgnoreCase("nominee@example.com"))
                    .thenReturn(Optional.of(new User("Nominee", "nominee@example.com", Role.EMPLOYEE, null)));

            Optional<String> result = check.evaluate(nomination("nominee@example.com"), Collections.emptyList());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("unknown nominee")
    class UnknownNominee {

        @Test
        @DisplayName("nominee not found -> flagged, reason names the email")
        void nomineeNotFound_isFlagged() {
            when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());

            Optional<String> result = check.evaluate(nomination("ghost@example.com"), Collections.emptyList());

            assertThat(result).isPresent();
            assertThat(result.get()).contains("ghost@example.com");
        }
    }

    @Nested
    @DisplayName("email lookup")
    class EmailLookup {

        @Test
        @DisplayName("surrounding whitespace is trimmed before querying")
        void whitespaceIsTrimmedBeforeQuerying() {
            when(userRepository.findByEmailIgnoreCase("nominee@example.com"))
                    .thenReturn(Optional.of(new User("Nominee", "nominee@example.com", Role.EMPLOYEE, null)));

            check.evaluate(nomination("  nominee@example.com  "), Collections.emptyList());

            verify(userRepository).findByEmailIgnoreCase("nominee@example.com");
        }
    }

    @Nested
    @DisplayName("null-safety")
    class NullSafety {

        @Test
        @DisplayName("null nomineeEmail does not throw, raises no flag, and never queries the repository")
        void nullNomineeEmail_doesNotThrow() {
            Optional<String> result = check.evaluate(nomination(null), Collections.emptyList());

            assertThat(result).isEmpty();
            verify(userRepository, never()).findByEmailIgnoreCase(any());
        }

        @Test
        @DisplayName("blank nomineeEmail does not throw, raises no flag, and never queries the repository")
        void blankNomineeEmail_doesNotThrow() {
            Optional<String> result = check.evaluate(nomination("   "), Collections.emptyList());

            assertThat(result).isEmpty();
            verify(userRepository, never()).findByEmailIgnoreCase(any());
        }
    }
}
