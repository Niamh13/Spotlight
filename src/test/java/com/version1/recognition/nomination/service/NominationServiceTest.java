package com.version1.recognition.nomination.service;

import com.version1.recognition.nomination.comms.NotificationService;
import com.version1.recognition.nomination.comms.SentEmail;
import com.version1.recognition.nomination.evaluation.AiEvaluationException;
import com.version1.recognition.nomination.evaluation.AiEvaluationResult;
import com.version1.recognition.nomination.evaluation.AiEvaluationStatus;
import com.version1.recognition.nomination.evaluation.NominationEvaluator;
import com.version1.recognition.nomination.exception.CoordinatorNotFoundException;
import com.version1.recognition.nomination.exception.InvalidReviewStateException;
import com.version1.recognition.nomination.exception.QuarterLimitReachedException;
import com.version1.recognition.nomination.exception.SelfNominationException;
import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.AuditAction;
import com.version1.recognition.nomination.model.AuditLogEntry;
import com.version1.recognition.nomination.model.AwardCategory;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.FlagSource;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.NominationFlag;
import com.version1.recognition.nomination.model.NominationStatus;
import com.version1.recognition.nomination.model.Quarter;
import com.version1.recognition.nomination.model.Role;
import com.version1.recognition.nomination.model.SentComm;
import com.version1.recognition.nomination.model.User;
import com.version1.recognition.nomination.repository.AuditLogRepository;
import com.version1.recognition.nomination.repository.NominationRepository;
import com.version1.recognition.nomination.repository.UserRepository;
import com.version1.recognition.nomination.web.ApproveRequest;
import com.version1.recognition.nomination.web.NominationRequest;
import com.version1.recognition.nomination.web.ReviewDecisionRequest;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NominationServiceTest {

    @Mock
    private NominationRepository repository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TaggingService taggingService;

    @Mock
    private NominationEvaluator evaluator;

    @Mock
    private UserRepository userRepository;

    private NominationService service;

    @BeforeEach
    void setUp() {
        service = new NominationService(
                repository, auditLogRepository, notificationService, taggingService, evaluator, userRepository);
        lenient().when(repository.save(any(Nomination.class))).thenAnswer(inv -> inv.getArgument(0));
        // Shared, lenient: every existing approve/reject/requestResubmission
        // test uses this literal coordinator email and doesn't itself care
        // about the coordinator-lookup behavior - only CoordinatorValidation
        // below overrides this stub to test the lookup itself.
        lenient().when(userRepository.findByEmailIgnoreCase("coordinator@example.com"))
                .thenReturn(Optional.of(new User("Coordinator", "coordinator@example.com", Role.COORDINATOR, null)));
    }

    private NominationRequest request(String nominatorEmail, String nomineeEmail, UUID originalNominationId) {
        NominationRequest req = new NominationRequest();
        req.setNominatorName("Nominator");
        req.setNominatorEmail(nominatorEmail);
        req.setNomineeName("Nominee");
        req.setNomineeEmail(nomineeEmail);
        req.setPractice("Practice");
        req.setLocation("Location");
        req.setCategory(AwardCategory.CUSTOMER_IMPACT);
        req.setCoreValue(CoreValue.DRIVE);
        req.setWhatText("What text with enough detail to pass every length check comfortably here.");
        req.setHowText("How text with enough detail to also pass every length check comfortably.");
        req.setOriginalNominationId(originalNominationId);
        return req;
    }

    @Nested
    @DisplayName("submit() - self-nomination guard")
    class SelfNomination {

        @Test
        @DisplayName("nominator and nominee sharing the same email (case-insensitive) throws SelfNominationException")
        void sameEmailDifferentCase_throwsSelfNomination() {
            NominationRequest req = request("Same@Example.com", "same@example.com", null);

            assertThatThrownBy(() -> service.submit(req))
                    .isInstanceOf(SelfNominationException.class);

            verify(repository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("submit() - quarter limit")
    class QuarterLimit {

        @Test
        @DisplayName("a second, independent nomination this quarter (existing one already decided) throws "
                + "QuarterLimitReachedException")
        void secondNominationAfterDecision_throws() {
            Nomination existing = new Nomination(
                    "Nominator", "nominator@example.com", "Someone Else", "else@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "existing what", "existing how", null);
            // Already decided (not PENDING_REVIEW), so this hits the "you've
            // already submitted" duplicate check rather than the "awaiting a
            // decision" guard below - the two throw different messages.
            existing.setStatus(NominationStatus.APPROVED);
            when(repository.findAll()).thenReturn(List.of(existing));

            NominationRequest req = request("nominator@example.com", "nominee@example.com", null);

            assertThatThrownBy(() -> service.submit(req))
                    .isInstanceOf(QuarterLimitReachedException.class)
                    .hasMessageContaining(Quarter.current().label());
        }

        @Test
        @DisplayName("a new submission while one is still PENDING_REVIEW this quarter throws "
                + "QuarterLimitReachedException, even before the duplicate-submission check runs")
        void newSubmissionWhileAwaitingDecision_throws() {
            // This is the rule that closes the resubmission-chain loophole: revise
            // A into B, then B into C, then C into D - each a different
            // "original", each previously allowed straight past the duplicate
            // check because nothing was blocking a *new*, unrelated submission
            // while an earlier one was still sitting with a coordinator.
            Nomination existing = new Nomination(
                    "Nominator", "nominator@example.com", "Someone Else", "else@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "existing what", "existing how", null);
            when(repository.findAll()).thenReturn(List.of(existing));

            NominationRequest req = request("nominator@example.com", "nominee@example.com", null);

            assertThatThrownBy(() -> service.submit(req))
                    .isInstanceOf(QuarterLimitReachedException.class)
                    .hasMessageContaining("waiting on a decision");
        }

        @Test
        @DisplayName("email comparison for the quarter limit ignores case and surrounding whitespace")
        void quarterLimitComparison_caseAndWhitespaceInsensitive() {
            Nomination existing = new Nomination(
                    "Nominator", "  Nominator@Example.com  ", "Someone Else", "else@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "existing what", "existing how", null);
            when(repository.findAll()).thenReturn(List.of(existing));

            NominationRequest req = request("nominator@example.com", "nominee@example.com", null);

            assertThatThrownBy(() -> service.submit(req)).isInstanceOf(QuarterLimitReachedException.class);
        }

        @Test
        @DisplayName("a resubmission against its own NEEDS_RESUBMISSION original succeeds")
        void resubmission_ofRevisableOriginal_succeeds() {
            when(evaluator.isAvailable()).thenReturn(false);
            when(taggingService.tag(any(), anyList())).thenReturn(List.of());
            when(taggingService.retagAll()).thenReturn(0);

            UUID originalId = UUID.randomUUID();
            Nomination original = new Nomination(
                    "Nominator", "nominator@example.com", "Someone Else", "else@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "existing what", "existing how", null);
            ReflectionTestUtils.setField(original, "id", originalId);
            original.setStatus(NominationStatus.NEEDS_RESUBMISSION);
            lenient().when(repository.findAll()).thenReturn(List.of(original));

            NominationRequest req = request("nominator@example.com", "nominee@example.com", originalId);

            Nomination result = service.submit(req);

            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("resubmitting against an id that isn't one of the nominator's own throws "
                + "QuarterLimitReachedException")
        void resubmission_ofSomeoneElsesOriginal_throws() {
            UUID originalId = UUID.randomUUID();
            Nomination someoneElsesOriginal = new Nomination(
                    "Someone Else", "someone.else@example.com", "Nominee", "nominee2@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "their what", "their how", null);
            ReflectionTestUtils.setField(someoneElsesOriginal, "id", originalId);
            someoneElsesOriginal.setStatus(NominationStatus.NEEDS_RESUBMISSION);
            when(repository.findAll()).thenReturn(List.of(someoneElsesOriginal));

            NominationRequest req = request("nominator@example.com", "nominee@example.com", originalId);

            assertThatThrownBy(() -> service.submit(req))
                    .isInstanceOf(QuarterLimitReachedException.class);
        }

        @Test
        @DisplayName("regression: resubmitting a second time against the same original this quarter is blocked "
                + "by the awaiting-decision guard, even though it's a different \"original\" each time")
        void secondResubmissionForSameOriginal_throws() {
            UUID originalId = UUID.randomUUID();
            Nomination original = new Nomination(
                    "Nominator", "nominator@example.com", "Someone Else", "else@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "existing what", "existing how", null);
            ReflectionTestUtils.setField(original, "id", originalId);
            original.setStatus(NominationStatus.NEEDS_RESUBMISSION);

            Nomination existingResubmission = new Nomination(
                    "Nominator", "nominator@example.com", "Someone Else", "else@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "revised what", "revised how", originalId);
            existingResubmission.setStatus(NominationStatus.PENDING_REVIEW);
            when(repository.findAll()).thenReturn(List.of(original, existingResubmission));

            NominationRequest req = request("nominator@example.com", "nominee@example.com", originalId);

            assertThatThrownBy(() -> service.submit(req))
                    .isInstanceOf(QuarterLimitReachedException.class);
        }

        @Test
        @DisplayName("T-12: an existing nomination from the PREVIOUS quarter does not block a new submission "
                + "this quarter - the limit resets each quarter")
        void existingNominationFromPreviousQuarter_doesNotBlockNewSubmission() {
            when(evaluator.isAvailable()).thenReturn(false);
            when(taggingService.tag(any(), anyList())).thenReturn(List.of());
            when(taggingService.retagAll()).thenReturn(0);

            Nomination lastQuarter = new Nomination(
                    "Nominator", "nominator@example.com", "Someone Else", "else@example.com",
                    "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                    "existing what", "existing how", null);
            ReflectionTestUtils.setField(lastQuarter, "submittedAt", Quarter.current().previous().start());
            lenient().when(repository.findAll()).thenReturn(List.of(lastQuarter));

            NominationRequest req = request("nominator@example.com", "nominee@example.com", null);

            Nomination result = service.submit(req);

            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("submit() -> evaluate() - AI fallback behavior")
    class EvaluateFallback {

        @BeforeEach
        void noExistingNominations() {
            lenient().when(repository.findAll()).thenReturn(List.of());
        }

        @Test
        @DisplayName("evaluator unavailable -> SKIPPED_NO_API_KEY, rule flags only, no score")
        void evaluatorUnavailable_skipsWithRuleFlagsOnly() {
            when(evaluator.isAvailable()).thenReturn(false);
            NominationFlag ruleFlag = new NominationFlag(AiFlag.ROUTINE_TASK_LANGUAGE, FlagSource.RULE, "routine");
            when(taggingService.tag(any(), anyList())).thenReturn(List.of(ruleFlag));
            when(taggingService.retagAll()).thenReturn(0);

            Nomination result = service.submit(request("a@example.com", "b@example.com", null));

            assertThat(result.getAiEvaluationStatus()).isEqualTo(AiEvaluationStatus.SKIPPED_NO_API_KEY);
            assertThat(result.getAiScore()).isNull();
            assertThat(result.getAiFlags()).containsExactly(ruleFlag);
            verify(evaluator, never()).evaluate(any());
        }

        @Test
        @DisplayName("evaluator throws AiEvaluationException -> FAILED, rule flags preserved, no score")
        void evaluatorThrows_marksFailedKeepsRuleFlags() {
            when(evaluator.isAvailable()).thenReturn(true);
            NominationFlag ruleFlag = new NominationFlag(AiFlag.WEAK_JUSTIFICATION, FlagSource.RULE, "thin");
            when(taggingService.tag(any(), anyList())).thenReturn(List.of(ruleFlag));
            when(taggingService.retagAll()).thenReturn(0);
            when(evaluator.evaluate(any())).thenThrow(new AiEvaluationException("timeout", null));

            Nomination result = service.submit(request("a@example.com", "b@example.com", null));

            assertThat(result.getAiEvaluationStatus()).isEqualTo(AiEvaluationStatus.FAILED);
            assertThat(result.getAiScore()).isNull();
            assertThat(result.getAiRationale()).isNull();
            assertThat(result.getAiFlags()).containsExactly(ruleFlag);
        }

        @Test
        @DisplayName("AI flag overlapping an existing rule flag is not duplicated - the rule version wins")
        void overlappingAiFlag_ruleVersionWins_noDuplicate() {
            when(evaluator.isAvailable()).thenReturn(true);
            NominationFlag ruleFlag = new NominationFlag(
                    AiFlag.WEAK_JUSTIFICATION, FlagSource.RULE, "under 150 characters, no figures");
            when(taggingService.tag(any(), anyList())).thenReturn(List.of(ruleFlag));
            when(taggingService.retagAll()).thenReturn(0);
            when(evaluator.evaluate(any())).thenReturn(new AiEvaluationResult(
                    40, "seems thin", List.of(AiFlag.WEAK_JUSTIFICATION), "v1"));

            Nomination result = service.submit(request("a@example.com", "b@example.com", null));

            assertThat(result.getAiFlags()).hasSize(1);
            assertThat(result.getAiFlags()).containsExactly(ruleFlag);
            assertThat(result.getAiEvaluationStatus()).isEqualTo(AiEvaluationStatus.COMPLETED);
            assertThat(result.getAiScore()).isEqualTo(40);
        }

        @Test
        @DisplayName("AI flag with no matching rule flag is added, sourced as AI")
        void nonOverlappingAiFlag_isAdded() {
            when(evaluator.isAvailable()).thenReturn(true);
            when(taggingService.tag(any(), anyList())).thenReturn(List.of());
            when(taggingService.retagAll()).thenReturn(0);
            when(evaluator.evaluate(any())).thenReturn(new AiEvaluationResult(
                    55, "borderline", List.of(AiFlag.ROUTINE_TASK_LANGUAGE), "v1"));

            Nomination result = service.submit(request("a@example.com", "b@example.com", null));

            assertThat(result.getAiFlags()).hasSize(1);
            NominationFlag added = result.getAiFlags().get(0);
            assertThat(added.getFlag()).isEqualTo(AiFlag.ROUTINE_TASK_LANGUAGE);
            assertThat(added.getSource()).isEqualTo(FlagSource.AI);
        }

        @Test
        @DisplayName("submit() always retags everything afterward, regardless of evaluator outcome")
        void submitAlwaysRetagsAfterward() {
            when(evaluator.isAvailable()).thenReturn(false);
            when(taggingService.tag(any(), anyList())).thenReturn(List.of());
            when(taggingService.retagAll()).thenReturn(0);

            service.submit(request("a@example.com", "b@example.com", null));

            verify(taggingService, times(1)).retagAll();
        }

        @Test
        @DisplayName("T-05 / T-27: however many flags a submission trips, the status is still PENDING_REVIEW - "
                + "flags never auto-decide")
        void multipleFlags_neverChangeStatusFromPendingReview() {
            when(evaluator.isAvailable()).thenReturn(true);
            NominationFlag weak = new NominationFlag(AiFlag.WEAK_JUSTIFICATION, FlagSource.RULE, "thin");
            NominationFlag routine = new NominationFlag(AiFlag.ROUTINE_TASK_LANGUAGE, FlagSource.RULE, "routine");
            when(taggingService.tag(any(), anyList())).thenReturn(List.of(weak, routine));
            when(taggingService.retagAll()).thenReturn(0);
            when(evaluator.evaluate(any())).thenReturn(new AiEvaluationResult(
                    10, "heavily flagged", List.of(AiFlag.WEAK_JUSTIFICATION, AiFlag.ROUTINE_TASK_LANGUAGE), "v1"));

            Nomination result = service.submit(request("a@example.com", "b@example.com", null));

            assertThat(result.getAiFlags()).hasSize(2);
            assertThat(result.getStatus()).isEqualTo(NominationStatus.PENDING_REVIEW);
        }
    }

    @Nested
    @DisplayName("approve() / reject() / requestResubmission() - coordinator validation")
    class CoordinatorValidation {

        @Test
        @DisplayName("approve() with an email unknown to the user directory throws CoordinatorNotFoundException, "
                + "before touching the nomination")
        void approveUnknownCoordinator_throws() {
            when(userRepository.findByEmailIgnoreCase("nobody@example.com")).thenReturn(Optional.empty());

            ApproveRequest req = new ApproveRequest();
            req.setCoordinatorEmail("nobody@example.com");

            assertThatThrownBy(() -> service.approve(UUID.randomUUID(), req))
                    .isInstanceOf(CoordinatorNotFoundException.class);

            verify(repository, never()).findById(any());
            verify(notificationService, never()).sendApprovalComms(any(), any());
            verify(auditLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("approve() with a known EMPLOYEE-role (not COORDINATOR) email throws CoordinatorNotFoundException")
        void approveKnownButNotCoordinator_throws() {
            when(userRepository.findByEmailIgnoreCase("sarah.murphy@version1.com"))
                    .thenReturn(Optional.of(new User("Sarah Murphy", "sarah.murphy@version1.com", Role.EMPLOYEE, null)));

            ApproveRequest req = new ApproveRequest();
            req.setCoordinatorEmail("sarah.murphy@version1.com");

            assertThatThrownBy(() -> service.approve(UUID.randomUUID(), req))
                    .isInstanceOf(CoordinatorNotFoundException.class);

            verify(auditLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("reject() with an unknown coordinator email throws, before touching the nomination")
        void rejectUnknownCoordinator_throws() {
            when(userRepository.findByEmailIgnoreCase("nobody@example.com")).thenReturn(Optional.empty());

            ReviewDecisionRequest req = new ReviewDecisionRequest();
            req.setCoordinatorEmail("nobody@example.com");
            req.setReason("Not enough detail");

            assertThatThrownBy(() -> service.reject(UUID.randomUUID(), req))
                    .isInstanceOf(CoordinatorNotFoundException.class);

            verify(repository, never()).findById(any());
            verify(notificationService, never()).sendDeclineComms(any(), any());
        }

        @Test
        @DisplayName("requestResubmission() with an unknown coordinator email throws, before touching the nomination")
        void requestResubmissionUnknownCoordinator_throws() {
            when(userRepository.findByEmailIgnoreCase("nobody@example.com")).thenReturn(Optional.empty());

            ReviewDecisionRequest req = new ReviewDecisionRequest();
            req.setCoordinatorEmail("nobody@example.com");
            req.setReason("Needs a number");

            assertThatThrownBy(() -> service.requestResubmission(UUID.randomUUID(), req))
                    .isInstanceOf(CoordinatorNotFoundException.class);

            verify(repository, never()).findById(any());
            verify(notificationService, never()).sendResubmissionRequestedComms(any(), any());
        }
    }

    @Nested
    @DisplayName("approve()")
    class Approve {

        @Test
        @DisplayName("sends confirmation to the nominator AND the award to the nominee, both recorded")
        void approve_sendsBothComms_recordsAudit() {
            UUID id = UUID.randomUUID();
            Nomination nomination = pendingNomination("nominator@example.com", "nominee@example.com");
            when(repository.findById(id)).thenReturn(Optional.of(nomination));
            when(notificationService.sendApprovalComms(any(), any()))
                    .thenReturn(new SentEmail("nominator@example.com", "Approved", "body"));
            when(notificationService.sendNomineeAwardComms(any()))
                    .thenReturn(new SentEmail("nominee@example.com", "You won!", "body"));

            ApproveRequest req = new ApproveRequest();
            req.setCoordinatorEmail("coordinator@example.com");
            req.setComment("Great work");

            Nomination result = service.approve(id, req);

            assertThat(result.getStatus()).isEqualTo(NominationStatus.APPROVED);
            assertThat(result.getCommsSentDate()).isNotNull();
            // T-19: the deciding coordinator is recorded on the nomination itself,
            // not just implied by who called the endpoint.
            assertThat(result.getCoordinatorEmail()).isEqualTo("coordinator@example.com");

            ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
            verify(auditLogRepository).save(captor.capture());
            AuditLogEntry entry = captor.getValue();
            assertThat(entry.getAction()).isEqualTo(AuditAction.APPROVED);
            assertThat(entry.getComms()).extracting(SentComm::getRecipientRole)
                    .containsExactlyInAnyOrder(SentComm.Recipient.NOMINATOR, SentComm.Recipient.NOMINEE);
        }

        @Test
        @DisplayName("approving a nomination that is not PENDING_REVIEW throws InvalidReviewStateException")
        void approveNonPending_throws() {
            UUID id = UUID.randomUUID();
            Nomination nomination = pendingNomination("nominator@example.com", "nominee@example.com");
            nomination.setStatus(NominationStatus.APPROVED);
            when(repository.findById(id)).thenReturn(Optional.of(nomination));

            ApproveRequest req = new ApproveRequest();
            req.setCoordinatorEmail("coordinator@example.com");

            assertThatThrownBy(() -> service.approve(id, req))
                    .isInstanceOf(InvalidReviewStateException.class);

            verify(notificationService, never()).sendApprovalComms(any(), any());
            verify(auditLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("approving an unknown id throws NoSuchElementException")
        void approveUnknownId_throwsNotFound() {
            UUID id = UUID.randomUUID();
            when(repository.findById(id)).thenReturn(Optional.empty());

            ApproveRequest req = new ApproveRequest();
            req.setCoordinatorEmail("coordinator@example.com");

            assertThatThrownBy(() -> service.approve(id, req))
                    .isInstanceOf(NoSuchElementException.class);
        }
    }

    @Nested
    @DisplayName("reject() and requestResubmission() - nominee is never told")
    class RejectAndResubmission {

        @Test
        @DisplayName("reject() sends comms to the nominator only, never the nominee")
        void reject_sendsToNominatorOnly() {
            UUID id = UUID.randomUUID();
            Nomination nomination = pendingNomination("nominator@example.com", "nominee@example.com");
            when(repository.findById(id)).thenReturn(Optional.of(nomination));
            when(notificationService.sendDeclineComms(any(), any()))
                    .thenReturn(new SentEmail("nominator@example.com", "Not this time", "body"));

            ReviewDecisionRequest req = new ReviewDecisionRequest();
            req.setCoordinatorEmail("coordinator@example.com");
            req.setReason("Not enough detail");

            Nomination result = service.reject(id, req);

            assertThat(result.getStatus()).isEqualTo(NominationStatus.REJECTED);
            assertThat(result.getRejectionReason()).isEqualTo("Not enough detail");
            // T-33: a comms-sent timestamp is recorded on rejection too, not just approval.
            assertThat(result.getCommsSentDate()).isNotNull();

            ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
            verify(auditLogRepository).save(captor.capture());
            assertThat(captor.getValue().getComms()).extracting(SentComm::getRecipientRole)
                    .containsExactly(SentComm.Recipient.NOMINATOR);
            verify(notificationService, never()).sendNomineeAwardComms(any());
        }

        @Test
        @DisplayName("requestResubmission() sends comms to the nominator only, never the nominee")
        void requestResubmission_sendsToNominatorOnly() {
            UUID id = UUID.randomUUID();
            Nomination nomination = pendingNomination("nominator@example.com", "nominee@example.com");
            when(repository.findById(id)).thenReturn(Optional.of(nomination));
            when(notificationService.sendResubmissionRequestedComms(any(), any()))
                    .thenReturn(new SentEmail("nominator@example.com", "More detail needed", "body"));

            ReviewDecisionRequest req = new ReviewDecisionRequest();
            req.setCoordinatorEmail("coordinator@example.com");
            req.setReason("Needs a number");

            Nomination result = service.requestResubmission(id, req);

            assertThat(result.getStatus()).isEqualTo(NominationStatus.NEEDS_RESUBMISSION);
            // T-33: a comms-sent timestamp is recorded on a resubmission request too.
            assertThat(result.getCommsSentDate()).isNotNull();

            ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
            verify(auditLogRepository).save(captor.capture());
            assertThat(captor.getValue().getComms()).extracting(SentComm::getRecipientRole)
                    .containsExactly(SentComm.Recipient.NOMINATOR);
            verify(notificationService, never()).sendNomineeAwardComms(any());
        }
    }

    @Nested
    @DisplayName("queries")
    class Queries {

        @Test
        @DisplayName("findById() throws NoSuchElementException for an unknown id")
        void findByIdUnknown_throws() {
            UUID id = UUID.randomUUID();
            when(repository.findById(id)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.findById(id)).isInstanceOf(NoSuchElementException.class);
        }

        @Test
        @DisplayName("getAuditLog() throws NoSuchElementException when the nomination itself doesn't exist")
        void getAuditLogUnknownNomination_throws() {
            UUID id = UUID.randomUUID();
            when(repository.existsById(id)).thenReturn(false);

            assertThatThrownBy(() -> service.getAuditLog(id)).isInstanceOf(NoSuchElementException.class);
            verify(auditLogRepository, never()).findByNominationIdOrderByOccurredAtAsc(any());
        }

        @Test
        @DisplayName("getAuditLog() returns the (possibly empty) history when the nomination exists")
        void getAuditLogExistingNomination_returnsHistory() {
            UUID id = UUID.randomUUID();
            when(repository.existsById(id)).thenReturn(true);
            when(auditLogRepository.findByNominationIdOrderByOccurredAtAsc(id)).thenReturn(List.of());

            assertThat(service.getAuditLog(id)).isEmpty();
        }

        @Test
        @DisplayName("findAll(null) returns everything unfiltered")
        void findAllNullFilter_returnsEverything() {
            when(repository.findAll()).thenReturn(List.of());

            service.findAll(null);

            verify(repository).findAll();
        }
    }

    private Nomination pendingNomination(String nominatorEmail, String nomineeEmail) {
        return new Nomination(
                "Nominator", nominatorEmail, "Nominee", nomineeEmail,
                "Practice", "Location", AwardCategory.CUSTOMER_IMPACT, CoreValue.DRIVE,
                "What text.", "How text.", null);
    }
}
