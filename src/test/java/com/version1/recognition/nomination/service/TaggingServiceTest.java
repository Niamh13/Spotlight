package com.version1.recognition.nomination.service;

import com.version1.recognition.nomination.check.NominationCheck;
import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.AwardCategory;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.FlagSource;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.NominationFlag;
import com.version1.recognition.nomination.repository.NominationRepository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaggingServiceTest {

    @Mock
    private NominationRepository repository;

    private Nomination nomination(String nominatorEmail, String nomineeEmail) {
        return new Nomination(
                "Nominator", nominatorEmail, "Nominee", nomineeEmail,
                "Practice", "Location", AwardCategory.COLLABORATION_AND_ENGAGEMENT,
                CoreValue.DRIVE, "What text with enough detail to pass length checks.",
                "How text that also has enough detail to pass length checks.", null);
    }

    @Nested
    @DisplayName("tag() - fault isolation")
    class FaultIsolation {

        @Mock
        private NominationCheck healthyCheckA;

        @Mock
        private NominationCheck throwingCheck;

        @Mock
        private NominationCheck healthyCheckB;

        @Test
        @DisplayName("one check throwing does not stop the others from running")
        void oneCheckThrowing_othersStillRun() {
            when(healthyCheckA.flag()).thenReturn(AiFlag.WEAK_JUSTIFICATION);
            when(healthyCheckA.evaluate(any(), any())).thenReturn(Optional.of("thin write-up"));

            when(throwingCheck.evaluate(any(), any()))
                    .thenThrow(new RuntimeException("boom - simulated bug in a check"));

            when(healthyCheckB.flag()).thenReturn(AiFlag.ROUTINE_TASK_LANGUAGE);
            when(healthyCheckB.evaluate(any(), any())).thenReturn(Optional.of("routine language"));

            TaggingService service = new TaggingService(
                    List.of(healthyCheckA, throwingCheck, healthyCheckB), repository);

            Nomination nomination = nomination("a@example.com", "b@example.com");
            List<NominationFlag> flags = service.tag(nomination, List.of(nomination));

            assertThat(flags).hasSize(2);
            assertThat(flags).extracting(NominationFlag::getFlag)
                    .containsExactlyInAnyOrder(AiFlag.WEAK_JUSTIFICATION, AiFlag.ROUTINE_TASK_LANGUAGE);
        }

        @Test
        @DisplayName("a check that raises no flag does not throw and contributes nothing")
        void checkRaisingNothing_contributesNoFlag() {
            when(healthyCheckA.evaluate(any(), any())).thenReturn(Optional.empty());

            TaggingService service = new TaggingService(List.of(healthyCheckA), repository);
            Nomination nomination = nomination("a@example.com", "b@example.com");

            List<NominationFlag> flags = service.tag(nomination, List.of(nomination));

            assertThat(flags).isEmpty();
        }

        @Test
        @DisplayName("every check is still invoked once, even after an earlier one throws")
        void allChecksAreInvokedExactlyOnce() {
            lenient().when(healthyCheckA.evaluate(any(), any())).thenReturn(Optional.empty());
            when(throwingCheck.evaluate(any(), any())).thenThrow(new IllegalStateException("bug"));
            lenient().when(healthyCheckB.evaluate(any(), any())).thenReturn(Optional.empty());

            TaggingService service = new TaggingService(
                    List.of(healthyCheckA, throwingCheck, healthyCheckB), repository);
            Nomination nomination = nomination("a@example.com", "b@example.com");

            service.tag(nomination, List.of(nomination));

            verify(healthyCheckA).evaluate(any(), any());
            verify(throwingCheck).evaluate(any(), any());
            verify(healthyCheckB).evaluate(any(), any());
        }
    }

    @Nested
    @DisplayName("retagAll() - AI flag preservation on merge")
    class RetagAllMerge {

        @Mock
        private NominationCheck check;

        @Test
        @DisplayName("an AI flag survives retag when no rule raises the same flag")
        void aiFlagSurvives_whenNoRuleMatches() {
            when(check.evaluate(any(), any())).thenReturn(Optional.empty());

            Nomination nomination = nomination("a@example.com", "b@example.com");
            nomination.setAiFlags(List.of(
                    new NominationFlag(AiFlag.WEAK_JUSTIFICATION, FlagSource.AI, "model said so")));

            when(repository.findAll()).thenReturn(List.of(nomination));

            TaggingService service = new TaggingService(List.of(check), repository);
            service.retagAll();

            assertThat(nomination.getAiFlags()).containsExactly(
                    new NominationFlag(AiFlag.WEAK_JUSTIFICATION, FlagSource.AI, "model said so"));
        }

        @Test
        @DisplayName("an AI flag is dropped on retag when a rule raises the same flag")
        void aiFlagDropped_whenRuleNowMatches() {
            when(check.flag()).thenReturn(AiFlag.WEAK_JUSTIFICATION);
            when(check.evaluate(any(), any())).thenReturn(Optional.of("now thin on rule grounds too"));

            Nomination nomination = nomination("a@example.com", "b@example.com");
            nomination.setAiFlags(List.of(
                    new NominationFlag(AiFlag.WEAK_JUSTIFICATION, FlagSource.AI, "model said so")));

            when(repository.findAll()).thenReturn(List.of(nomination));

            TaggingService service = new TaggingService(List.of(check), repository);
            service.retagAll();

            assertThat(nomination.getAiFlags()).containsExactly(
                    new NominationFlag(AiFlag.WEAK_JUSTIFICATION, FlagSource.RULE, "now thin on rule grounds too"));
        }

        @Test
        @DisplayName("retagAll() saves the updated nominations and returns the flagged count")
        void retagAllSavesAndReturnsFlaggedCount() {
            when(check.flag()).thenReturn(AiFlag.ROUTINE_TASK_LANGUAGE);
            when(check.evaluate(any(), any())).thenReturn(Optional.of("routine phrasing"));

            Nomination flagged = nomination("a@example.com", "b@example.com");
            when(repository.findAll()).thenReturn(List.of(flagged));

            TaggingService service = new TaggingService(List.of(check), repository);
            int flaggedCount = service.retagAll();

            assertThat(flaggedCount).isEqualTo(1);
            verify(repository).saveAll(List.of(flagged));
        }
    }
}
