package com.version1.recognition.nomination.service;

import com.version1.recognition.nomination.comms.NotificationService;
import com.version1.recognition.nomination.comms.SentEmail;
import com.version1.recognition.nomination.evaluation.AiEvaluationException;
import com.version1.recognition.nomination.evaluation.AiEvaluationResult;
import com.version1.recognition.nomination.evaluation.AiEvaluationStatus;
import com.version1.recognition.nomination.evaluation.NominationEvaluator;
import com.version1.recognition.nomination.exception.InvalidReviewStateException;
import com.version1.recognition.nomination.exception.QuarterLimitReachedException;
import com.version1.recognition.nomination.exception.SelfNominationException;
import com.version1.recognition.nomination.model.AuditAction;
import com.version1.recognition.nomination.model.AuditLogEntry;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.FlagSource;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.NominationFlag;
import com.version1.recognition.nomination.model.NominationStatus;
import com.version1.recognition.nomination.model.Quarter;
import com.version1.recognition.nomination.model.SentComm;
import com.version1.recognition.nomination.repository.AuditLogRepository;
import com.version1.recognition.nomination.repository.NominationRepository;
import com.version1.recognition.nomination.web.ApproveRequest;
import com.version1.recognition.nomination.web.NominationRequest;
import com.version1.recognition.nomination.web.ReviewDecisionRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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

        requireNoNominationThisQuarter(request);

        Nomination nomination = new Nomination(
                request.getNominatorName(),
                request.getNominatorEmail(),
                request.getNomineeName(),
                request.getNomineeEmail(),
                request.getPractice(),
                request.getLocation(),
                request.getCategory(),
                resolveCoreValue(request),
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

    /**
     * The value the nomination claims.
     *
     * <p>The form no longer offers a dropdown - nominators name the value in the
     * HOW, in their own words - so this reads it back out of the text. Recording
     * it keeps per-value reporting working without making anyone pick from a
     * list before they have written anything.
     *
     * <p>An explicit value on the request still wins, for API clients that know
     * what they mean.
     */
    private CoreValue resolveCoreValue(NominationRequest request) {
        if (request.getCoreValue() != null) {
            return request.getCoreValue();
        }
        return CoreValue.detectIn(request.getHowText()).orElse(null);
    }

    /**
     * Runs the rules, then the AI. The rules always run - they're local and
     * can't fail. The AI is best-effort: if it's unavailable or errors, the
     * nomination still reaches the coordinator with its rule flags and a visible
     * "unavailable" status, never blocked.
     */
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

            // The rules and the model overlap - both can raise WEAK_JUSTIFICATION
            // for the same nomination - and showing a coordinator the same flag
            // twice reads as two separate problems. Where they agree, keep the
            // rule's version: it says exactly what tripped ("under 150
            // characters, no figures") rather than just asserting it.
            result.getFlags().stream()
                    .filter(flag -> flags.stream().noneMatch(existing -> existing.getFlag() == flag))
                    .forEach(flag -> flags.add(new NominationFlag(
                            flag, FlagSource.AI,
                            "Also raised by the AI language evaluator (prompt "
                                    + result.getPromptVersion() + ").")));
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

    /**
     * Approves a nomination and sends both messages: a confirmation to the
     * nominator, and the award itself to the nominee with the nomination quoted
     * in full.
     */
    public Nomination approve(UUID id, ApproveRequest request) {
        Nomination nomination = requirePendingReview(id);

        nomination.setStatus(NominationStatus.APPROVED);
        nomination.setCoordinatorEmail(request.getCoordinatorEmail());
        nomination.setDecisionDate(java.time.Instant.now());
        repository.save(nomination);

        AuditLogEntry entry = new AuditLogEntry(id, request.getCoordinatorEmail(),
                AuditAction.APPROVED, null, request.getComment());
        // Two messages on approval: the nominator gets a confirmation, and the
        // nominee gets the award itself with the nomination quoted in full.
        SentEmail toNominator = notificationService.sendApprovalComms(nomination, request.getComment());
        entry.recordComm(new SentComm(toNominator.getRecipient(), SentComm.Recipient.NOMINATOR,
                toNominator.getSubject(), toNominator.getBody()));

        SentEmail toNominee = notificationService.sendNomineeAwardComms(nomination);
        entry.recordComm(new SentComm(toNominee.getRecipient(), SentComm.Recipient.NOMINEE,
                toNominee.getSubject(), toNominee.getBody()));

        auditLogRepository.save(entry);

        nomination.setCommsSentDate(java.time.Instant.now());
        return repository.save(nomination);

        // Epic 4 (Reachdesk gift card) hangs off this method next - trigger
        // the campaign send here once approved, before or after comms.
    }

    /**
     * Rejects a nomination. The reason is mandatory and goes to the nominator -
     * only the nominator. Telling a nominee their nomination was turned down
     * helps nobody.
     */
    public Nomination reject(UUID id, ReviewDecisionRequest request) {
        Nomination nomination = requirePendingReview(id);

        nomination.setStatus(NominationStatus.REJECTED);
        nomination.setCoordinatorEmail(request.getCoordinatorEmail());
        nomination.setRejectionReason(request.getReason());
        nomination.setDecisionDate(java.time.Instant.now());
        repository.save(nomination);

        AuditLogEntry entry = new AuditLogEntry(id, request.getCoordinatorEmail(),
                AuditAction.REJECTED, request.getReason(), request.getComment());
        // Only the nominator hears about this one - telling a nominee their
        // nomination was turned down helps nobody.
        SentEmail email = notificationService.sendDeclineComms(nomination, request.getComment());
        entry.recordComm(new SentComm(email.getRecipient(), SentComm.Recipient.NOMINATOR,
                email.getSubject(), email.getBody()));
        auditLogRepository.save(entry);

        nomination.setCommsSentDate(java.time.Instant.now());
        return repository.save(nomination);
    }

    /**
     * Sends a nomination back for more detail. Distinct from rejection: the
     * nominator is expected to revise and resubmit, and doing so doesn't use up
     * another of their quarterly nominations.
     */
    public Nomination requestResubmission(UUID id, ReviewDecisionRequest request) {
        Nomination nomination = requirePendingReview(id);

        nomination.setStatus(NominationStatus.NEEDS_RESUBMISSION);
        nomination.setCoordinatorEmail(request.getCoordinatorEmail());
        nomination.setRejectionReason(request.getReason());
        nomination.setDecisionDate(java.time.Instant.now());
        repository.save(nomination);

        AuditLogEntry entry = new AuditLogEntry(id, request.getCoordinatorEmail(),
                AuditAction.RESUBMISSION_REQUESTED, request.getReason(), request.getComment());
        // Only the nominator hears about this one - telling a nominee their
        // nomination was turned down helps nobody.
        SentEmail email = notificationService.sendResubmissionRequestedComms(nomination, request.getComment());
        entry.recordComm(new SentComm(email.getRecipient(), SentComm.Recipient.NOMINATOR,
                email.getSubject(), email.getBody()));
        auditLogRepository.save(entry);

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

    /**
     * One nomination per person per quarter.
     * <p>
     * This supersedes the earlier "no duplicate while pending" rule, which only
     * stopped the same nominator/nominee pair repeating. The scheme is a vote:
     * everyone gets one, so the limit is on the nominator regardless of who they
     * nominate, and regardless of how the first one turned out. A rejected
     * nomination still spent that quarter's slot.
     * <p>
     * Resubmissions are exempt. A coordinator asked for those, and they continue
     * the original entry rather than starting a second one - without this
     * exemption, asking someone for more detail would lock them out of answering.
     */
    private void requireNoNominationThisQuarter(NominationRequest request) {
        Quarter quarter = Quarter.current();

        List<Nomination> all = repository.findAll();

        List<Nomination> mineThisQuarter = all.stream()
                .filter(n -> n.getSubmittedAt() != null)
                .filter(n -> quarter.contains(n.getSubmittedAt()))
                .filter(n -> equalsIgnoreCase(n.getNominatorEmail(), request.getNominatorEmail()))
                .collect(Collectors.toList());

        // Nothing at all may be submitted while something of theirs is still
        // waiting on a coordinator - original or revision.
        //
        // This is the rule that was missing. The previous check only stopped
        // someone revising the *same* nomination twice, so a chain walked
        // straight past it: revise A into B, then revise B into C, then C into
        // D, each one a different "original" and each one allowed.
        Nomination awaiting = mineThisQuarter.stream()
                .filter(n -> n.getStatus() == NominationStatus.PENDING_REVIEW)
                .findFirst()
                .orElse(null);

        if (awaiting != null) {
            throw new QuarterLimitReachedException(
                    "You already have a nomination for " + awaiting.getNomineeName()
                            + " waiting on a decision. You'll be able to submit again once a "
                            + "coordinator has reviewed it.",
                    quarter.label());
        }

        if (request.getOriginalNominationId() != null) {
            requireRevisableOriginal(request, all);
            return;
        }

        Nomination existing = mineThisQuarter.stream()
                .filter(n -> n.getOriginalNominationId() == null)
                .findFirst()
                .orElse(null);

        if (existing != null) {
            // Deliberately no review status. Where a nomination has got to is a
            // coordinator's working state; the nominator is told the outcome by
            // email when there is one, not by watching the queue.
            throw new QuarterLimitReachedException(
                    "You've already submitted your nomination for " + quarter.label() + " - "
                            + existing.getNomineeName() + ". Everyone gets one nomination per "
                            + "quarter. You'll be able to submit again from "
                            + quarter.next().label() + ".",
                    quarter.label());
        }
    }

    /**
     * A revision has to be answering something that was actually sent back.
     * Without this, quoting any id at all would bypass the quarter limit.
     */
    private void requireRevisableOriginal(NominationRequest request, List<Nomination> all) {
        // Looked up in the list already loaded rather than with a second query -
        // one read instead of two, and it keeps this testable without stubbing
        // findById separately.
        Nomination original = all.stream()
                .filter(n -> request.getOriginalNominationId().equals(n.getId()))
                .findFirst()
                .orElse(null);

        if (original == null
                || !equalsIgnoreCase(original.getNominatorEmail(), request.getNominatorEmail())) {
            throw new QuarterLimitReachedException(
                    "That nomination can't be revised - it isn't one of yours.",
                    Quarter.current().label());
        }

        boolean invitedBack = original.getStatus() == NominationStatus.NEEDS_RESUBMISSION
                || original.getStatus() == NominationStatus.REJECTED;

        if (!invitedBack) {
            throw new QuarterLimitReachedException(
                    "That nomination doesn't need revising, so this would be a second "
                            + "nomination for " + Quarter.current().label() + ".",
                    Quarter.current().label());
        }
    }

    /** The nomination this person has already made in the current quarter, if any. */
    public Nomination findCurrentQuarterNomination(String nominatorEmail) {
        Quarter quarter = Quarter.current();
        // The newest, not the original. A revision supersedes what it replaces,
        // so returning the original left the form offering to revise something
        // that had already been revised.
        return repository.findAll().stream()
                .filter(n -> n.getSubmittedAt() != null)
                .filter(n -> equalsIgnoreCase(n.getNominatorEmail(), nominatorEmail))
                .filter(n -> quarter.contains(n.getSubmittedAt()))
                .max(java.util.Comparator.comparing(Nomination::getSubmittedAt))
                .orElse(null);
    }

    private boolean equalsIgnoreCase(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
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
