package com.version1.recognition.nomination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class NominationService {

    private static final Logger log = LoggerFactory.getLogger(NominationService.class);

    private final NominationRepository repository;
    private final NominationEvaluator evaluator;

    public NominationService(NominationRepository repository, NominationEvaluator evaluator) {
        this.repository = repository;
        this.evaluator = evaluator;
    }

    /**
     * Handles a new nomination submission (Epic 1), including a resubmission
     * of a previously rejected one (originalNominationId set).
     * <p>
     * NOTE: this saves as PENDING_REVIEW with no AI flags yet. The next bit
     * of work (Epic 2) hangs an advisory tagging step off submit() here -
     * it will attach flags for the coordinator to see, but per the brief it
     * never blocks submission or decides the outcome itself.
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
        Nomination saved = repository.save(nomination);

        // Evaluate on the way in so the gaps are already visible when a coordinator
        // opens it. Advisory only - an incomplete nomination is still accepted and
        // still saved as PENDING_REVIEW. Requesting the resubmission is a separate,
        // human-initiated step (see ResubmissionService).
        NominationEvaluation evaluation = evaluator.evaluate(saved);
        if (evaluation.flagsIncompleteInformation()) {
            log.info("Nomination {} submitted with {} failing criteria: {}",
                    saved.getId(), evaluation.getFailingCriteria().size(), evaluation.getFailingCriteria());
        }

        return saved;
    }

    public Nomination findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("No nomination found with id " + id));
    }

    public List<Nomination> findAll() {
        return repository.findAll();
    }
}
