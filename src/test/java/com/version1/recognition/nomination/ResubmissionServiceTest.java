package com.version1.recognition.nomination;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Covers the acceptance criterion "a resubmission request is sent when
 * evaluation flags missing or insufficient information".
 */
class ResubmissionServiceTest {

    private NominationRepository nominationRepository;
    private ResubmissionRequestRepository requestRepository;
    private ResubmissionNotifier notifier;
    private ResubmissionService service;

    private static final UUID ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        nominationRepository = mock(NominationRepository.class);
        requestRepository = mock(ResubmissionRequestRepository.class);
        notifier = mock(ResubmissionNotifier.class);
        service = new ResubmissionService(nominationRepository, requestRepository,
                new NominationEvaluator(), new ResubmissionMessageFactory(), notifier);

        when(requestRepository.save(any(ResubmissionRequest.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private Nomination given(String what, String how) {
        Nomination nomination = new Nomination("Jamie Doyle", "jamie.doyle@version1.com",
                "Alex Rivera", "alex.rivera@version1.com",
                "Cloud Engineering", "Dublin", what, how, null);
        when(nominationRepository.findById(ID)).thenReturn(Optional.of(nomination));
        return nomination;
    }

    private static final String GOOD_WHAT =
            "Led the release rollout over a tight weekend and saved the client two days of downtime.";
    private static final String GOOD_HOW =
            "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure.";

    @Test
    void sendsARequestListingTheFailingCriteria() {
        Nomination nomination = given("Did stuff.", "Was good.");

        ResubmissionRequest request = service.requestResubmission(ID, "colette.lynch@version1.com");

        // It was sent, to the nominator.
        verify(notifier).send(eq(nomination), eq("jamie.doyle@version1.com"), anyString());

        // The record lists every criterion, and the message names each one.
        assertThat(request.getFailingCriteria()).contains(
                EvaluationCriterion.WHAT_TOO_BRIEF,
                EvaluationCriterion.WHAT_MISSING_IMPACT,
                EvaluationCriterion.HOW_TOO_BRIEF,
                EvaluationCriterion.HOW_NO_CORE_VALUE);
        for (EvaluationCriterion criterion : request.getFailingCriteria()) {
            assertThat(request.getMessage()).contains(criterion.getGap());
        }
        assertThat(request.getRecipientEmail()).isEqualTo("jamie.doyle@version1.com");
        assertThat(request.getRequestedByEmail()).isEqualTo("colette.lynch@version1.com");
        assertThat(request.getSentAt()).isNotNull();
    }

    @Test
    void movesTheNominationToResubmissionRequestedAndStampsComms() {
        Nomination nomination = given("Did stuff.", "Was good.");

        service.requestResubmission(ID, "colette.lynch@version1.com");

        assertThat(nomination.getStatus()).isEqualTo(NominationStatus.RESUBMISSION_REQUESTED);
        assertThat(nomination.getCommsSentDate()).isNotNull();
        assertThat(nomination.getCoordinatorEmail()).isEqualTo("colette.lynch@version1.com");
        verify(nominationRepository).save(nomination);
    }

    @Test
    void refusesWhenTheNominationPassesEvaluation() {
        given(GOOD_WHAT, GOOD_HOW);

        assertThatThrownBy(() -> service.requestResubmission(ID, null))
                .isInstanceOf(ResubmissionNotApplicableException.class)
                .hasMessageContaining("nothing to request");

        verifyNoInteractions(notifier);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void refusesWhenAlreadyDecided() {
        Nomination nomination = given("Did stuff.", "Was good.");
        nomination.setStatus(NominationStatus.APPROVED);

        assertThatThrownBy(() -> service.requestResubmission(ID, null))
                .isInstanceOf(ResubmissionNotApplicableException.class)
                .hasMessageContaining("APPROVED");

        verifyNoInteractions(notifier);
    }

    @Test
    void refusesToSendTwice() {
        Nomination nomination = given("Did stuff.", "Was good.");
        service.requestResubmission(ID, null);
        reset(notifier);

        assertThatThrownBy(() -> service.requestResubmission(ID, null))
                .isInstanceOf(ResubmissionNotApplicableException.class)
                .hasMessageContaining("RESUBMISSION_REQUESTED");

        verifyNoInteractions(notifier);
        assertThat(nomination.getStatus()).isEqualTo(NominationStatus.RESUBMISSION_REQUESTED);
    }

    @Test
    void writesNothingIfDeliveryFails() {
        Nomination nomination = given("Did stuff.", "Was good.");
        doThrow(new ResubmissionNotifier.NotificationFailedException("smtp down", null))
                .when(notifier).send(any(), anyString(), anyString());

        assertThatThrownBy(() -> service.requestResubmission(ID, null))
                .isInstanceOf(ResubmissionNotifier.NotificationFailedException.class);

        verify(requestRepository, never()).save(any());
        assertThat(nomination.getStatus()).isEqualTo(NominationStatus.PENDING_REVIEW);
        assertThat(nomination.getCommsSentDate()).isNull();
    }

    @Test
    void unknownNominationIsNotFound() {
        when(nominationRepository.findById(ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requestResubmission(ID, null))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void evaluationIsReadOnly() {
        given("Did stuff.", "Was good.");

        NominationEvaluation evaluation = service.evaluate(ID);

        assertThat(evaluation.flagsIncompleteInformation()).isTrue();
        verifyNoInteractions(notifier);
        verify(requestRepository, never()).save(any());
        verify(nominationRepository, never()).save(any());
    }

    @Test
    void listsRequestsForANomination() {
        given("Did stuff.", "Was good.");
        when(requestRepository.findByNominationIdOrderBySentAtDesc(ID)).thenReturn(List.of());

        assertThat(service.findRequestsFor(ID)).isEmpty();
    }
}
