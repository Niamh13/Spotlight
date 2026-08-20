package com.version1.recognition.nomination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NominationService {

    private static final Logger log = LoggerFactory.getLogger(NominationService.class);

    private final NominationRepository repository;
    private final AuditLogRepository auditLogRepository;
    private final NotificationService notificationService;
    private final TaggingService taggingService;
    private final NominationEvaluator evaluator;

    public NominationService(NominationRepository repository,
                              AuditLogRepository auditLogRepository,
                              NotificationService notificationService,
                              TaggingService taggingService,
                              NominationEvaluator evaluator) {
        this.repository = repository;
        this.auditLogRepository = auditLogRepository;
        this.notificationService = notificationService;
        this.taggingService = taggingService;
        this.evaluator = evaluator;
    }

    /**
     * Handles a new nomination submission (Epic 1), including a resubmission
     * of a previously rejected/needs-resubmission one (originalNominationId set).
     * <p>
     * Runs Epic 2's tagging immediately after saving: deterministic checks
     * always run (they're just queries, they can't fail), the AI evaluator
     * is best-effort - if it's unavailable or errors, the nomination still
     * reaches the coordinator with whatever deterministic flags apply and a
     * visible "AI review unavailable" status, never blocked.
     */
    public Nomination submit(NominationRequest request) {
        if (request.getNominatorEmail().equalsIgnoreCase(request.getNomineeEmail())) {
            throw new SelfNominationException("You can't nominate yourself.");
        }

        Nomination nomination = new Nomination(
                request.getNominatorName(),
                request.getNominatorEmail(),
                request.getNomineeName(),
                request.getNomineeEmail(),
                request.getPractice(),
                request.getLocation(),
                request.getWhatText(),
                request.getHowText(),
                request.getOriginalNominationId()
        );
        nomination = repository.save(nomination);

        evaluate(nomination);
        Nomination saved = repository.save(nomination);

        // The reciprocal and repeat checks read the rest of the table, so this
        // submission can change the correct answer for nominations already on
        // record - B nominating A back makes A's earlier nomination reciprocal
        // too. Retag everything rather than leave half the pair unmarked.
        taggingService.retagAll();

        return repository.findById(saved.getId()).orElse(saved);
    }

    private void evaluate(Nomination nomination) {
        List<NominationFlag> flags = new ArrayList<>(
                taggingService.tag(nomination, repository.findAll()));

        if (!evaluator.isAvailable()) {
            nomination.setAiEvaluationStatus(AiEvaluationStatus.SKIPPED_NO_API_KEY);
            nomination.setAiFlags(flags);
            log.warn("AI evaluator unavailable (no API key configured) for nomination {} - rule flags only.",
                    nomination.getId());
            return;
        }

        try {
            AiEvaluationResult result = evaluator.evaluate(nomination);
            result.getFlags().forEach(flag -> flags.add(new NominationFlag(
                    flag, FlagSource.AI,
                    "Raised by the AI language evaluator (prompt " + result.getPromptVersion() + ").")));
            nomination.setAiFlags(flags);
            nomination.setAiScore(result.getScore());
            nomination.setAiRationale(result.getRationale());
            nomination.setAiPromptVersion(result.getPromptVersion());
            nomination.setAiEvaluationStatus(AiEvaluationStatus.COMPLETED);
        } catch (AiEvaluationException e) {
            log.error("AI evaluation failed for nomination {} - falling back to rule flags only.",
                    nomination.getId(), e);
            nomination.setAiFlags(flags);
            nomination.setAiEvaluationStatus(AiEvaluationStatus.FAILED);
            // score/rationale/promptVersion stay null - the dashboard shows
            // "AI review unavailable" instead of a stale or fabricated result.
        }
    }

    /** Forces a rule-flag pass over every nomination. Coordinator action. */
    public int retagAll() {
        return taggingService.retagAll();
    }

    public Nomination approve(UUID id, ApproveRequest request) {
        Nomination nomination = requirePendingReview(id);

        nomination.setStatus(NominationStatus.APPROVED);
        nomination.setCoordinatorEmail(request.getCoordinatorEmail());
        nomination.setDecisionDate(java.time.Instant.now());
        repository.save(nomination);

        auditLogRepository.save(new AuditLogEntry(id, request.getCoordinatorEmail(), AuditAction.APPROVED, null));

        notificationService.sendApprovalComms(nomination);
        nomination.setCommsSentDate(java.time.Instant.now());
        return repository.save(nomination);

        // Epic 4 (Reachdesk gift card) hangs off this method next - trigger
        // the campaign send here once approved, before or after comms.
    }

    public Nomination reject(UUID id, ReviewDecisionRequest request) {
        Nomination nomination = requirePendingReview(id);

        nomination.setStatus(NominationStatus.REJECTED);
        nomination.setCoordinatorEmail(request.getCoordinatorEmail());
        nomination.setRejectionReason(request.getReason());
        nomination.setDecisionDate(java.time.Instant.now());
        repository.save(nomination);

        auditLogRepository.save(new AuditLogEntry(id, request.getCoordinatorEmail(), AuditAction.REJECTED, request.getReason()));

        notificationService.sendDeclineComms(nomination);
        nomination.setCommsSentDate(java.time.Instant.now());
        return repository.save(nomination);
    }

    public Nomination requestResubmission(UUID id, ReviewDecisionRequest request) {
        Nomination nomination = requirePendingReview(id);

        nomination.setStatus(NominationStatus.NEEDS_RESUBMISSION);
        nomination.setCoordinatorEmail(request.getCoordinatorEmail());
        nomination.setRejectionReason(request.getReason());
        nomination.setDecisionDate(java.time.Instant.now());
        repository.save(nomination);

        auditLogRepository.save(new AuditLogEntry(id, request.getCoordinatorEmail(), AuditAction.RESUBMISSION_REQUESTED, request.getReason()));

        notificationService.sendResubmissionRequestedComms(nomination);
        nomination.setCommsSentDate(java.time.Instant.now());
        return repository.save(nomination);
    }

    public List<AuditLogEntry> getAuditLog(UUID nominationId) {
        // Confirms the nomination exists before returning (possibly empty) history.
        requireExists(nominationId);
        return auditLogRepository.findByNominationIdOrderByOccurredAtAsc(nominationId);
    }

    public Nomination findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("No nomination found with id " + id));
    }

    public List<Nomination> findAll(NominationStatus statusFilter) {
        if (statusFilter == null) {
            return repository.findAll();
        }
        return repository.findAll().stream()
                .filter(n -> n.getStatus() == statusFilter)
                .collect(Collectors.toList());
    }

    private Nomination requirePendingReview(UUID id) {
        Nomination nomination = findById(id);
        if (nomination.getStatus() != NominationStatus.PENDING_REVIEW) {
            throw new InvalidReviewStateException(
                    "Nomination " + id + " is already " + nomination.getStatus() + " and can't be reviewed again.");
        }
        return nomination;
    }

    private void requireExists(UUID id) {
        if (!repository.existsById(id)) {
            throw new NoSuchElementException("No nomination found with id " + id);
        }
    }
}
