package com.version1.recognition.nomination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Sends resubmission requests for nominations the evaluation found incomplete.
 * <p>
 * The evaluation itself never sends anything - a coordinator decides. See
 * {@link NominationEvaluator} for why that separation matters given how blunt
 * the current criteria are.
 */
@Service
public class ResubmissionService {

    private static final Logger log = LoggerFactory.getLogger(ResubmissionService.class);

    private final NominationRepository nominationRepository;
    private final ResubmissionRequestRepository resubmissionRequestRepository;
    private final NominationEvaluator evaluator;
    private final ResubmissionMessageFactory messageFactory;
    private final ResubmissionNotifier notifier;

    public ResubmissionService(NominationRepository nominationRepository,
                               ResubmissionRequestRepository resubmissionRequestRepository,
                               NominationEvaluator evaluator,
                               ResubmissionMessageFactory messageFactory,
                               ResubmissionNotifier notifier) {
        this.nominationRepository = nominationRepository;
        this.resubmissionRequestRepository = resubmissionRequestRepository;
        this.evaluator = evaluator;
        this.messageFactory = messageFactory;
        this.notifier = notifier;
    }

    public NominationEvaluation evaluate(UUID nominationId) {
        return evaluator.evaluate(findNomination(nominationId));
    }

    public NominationEvaluation evaluate(Nomination nomination) {
        return evaluator.evaluate(nomination);
    }

    /**
     * Sends a resubmission request listing every criterion the nomination failed,
     * moves it to {@link NominationStatus#RESUBMISSION_REQUESTED} and stamps
     * {@code commsSentDate}.
     *
     * @throws ResubmissionNotApplicableException if the nomination has already been
     *         decided or already has a request out, or if the evaluation found
     *         nothing to ask for.
     */
    @Transactional
    public ResubmissionRequest requestResubmission(UUID nominationId, String requestedByEmail) {
        Nomination nomination = findNomination(nominationId);

        if (nomination.getStatus() != NominationStatus.PENDING_REVIEW) {
            throw new ResubmissionNotApplicableException(
                    "Nomination " + nominationId + " is " + nomination.getStatus()
                            + " - a resubmission can only be requested while it is still PENDING_REVIEW.");
        }

        NominationEvaluation evaluation = evaluator.evaluate(nomination);
        if (!evaluation.flagsIncompleteInformation()) {
            throw new ResubmissionNotApplicableException(
                    "Nomination " + nominationId + " passed evaluation - there is nothing to request.");
        }

        String message = messageFactory.build(nomination, evaluation);

        // Deliver first: if this throws, nothing is written and the nomination stays
        // PENDING_REVIEW, so a failed send can simply be retried. Once real mail
        // replaces the stub this wants an outbox instead - a send that succeeds while
        // the transaction below rolls back would go unrecorded.
        notifier.send(nomination, nomination.getNominatorEmail(), message);

        Instant sentAt = Instant.now();
        ResubmissionRequest request = resubmissionRequestRepository.save(new ResubmissionRequest(
                nomination.getId(),
                nomination.getNominatorEmail(),
                requestedByEmail,
                evaluation.getFailingCriteria(),
                message,
                sentAt));

        nomination.setStatus(NominationStatus.RESUBMISSION_REQUESTED);
        nomination.setCommsSentDate(sentAt);
        if (requestedByEmail != null && !requestedByEmail.isBlank()) {
            nomination.setCoordinatorEmail(requestedByEmail);
        }
        nominationRepository.save(nomination);

        log.info("Resubmission requested for nomination {} - {} failing criteria: {}",
                nomination.getId(), evaluation.getFailingCriteria().size(), evaluation.getFailingCriteria());

        return request;
    }

    public List<ResubmissionRequest> findRequestsFor(UUID nominationId) {
        findNomination(nominationId);   // 404 rather than an empty list for an unknown id
        return resubmissionRequestRepository.findByNominationIdOrderBySentAtDesc(nominationId);
    }

    private Nomination findNomination(UUID id) {
        return nominationRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("No nomination found with id " + id));
    }
}
