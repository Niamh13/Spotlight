package com.version1.recognition.nomination;

import com.version1.recognition.nomination.check.NominationCheck;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Runs every {@link NominationCheck} over a nomination and collects whatever
 * flags come back.
 * <p>
 * There is no logic here beyond "run them all" - that is the point of the
 * pattern. Spring injects every {@code NominationCheck} bean on the classpath,
 * so a seventh rule is a seventh class and no edit to this file.
 *
 * <h2>Why retagging exists</h2>
 * Two of the checks - reciprocal and repeat - depend on the <em>other</em>
 * nominations on record, so their answer changes as new ones arrive. If A
 * nominates B on Monday and B nominates A on Tuesday, tagging only at submission
 * time would flag Tuesday's nomination and leave Monday's clean, which is
 * exactly backwards from what a coordinator needs to see. So a submission
 * retags everything, not just itself.
 * <p>
 * Retagging replaces {@link FlagSource#RULE} flags and preserves
 * {@link FlagSource#AI} ones: rule flags are reproducible from current data,
 * whereas an AI flag is a record of what a model said once and cannot be
 * regenerated.
 */
@Service
public class TaggingService {

    private static final Logger log = LoggerFactory.getLogger(TaggingService.class);

    private final List<NominationCheck> checks;
    private final NominationRepository repository;

    public TaggingService(List<NominationCheck> checks, NominationRepository repository) {
        this.checks = checks;
        this.repository = repository;
        log.info("Tagging service started with {} checks: {}", checks.size(),
                checks.stream().map(c -> c.getClass().getSimpleName()).toList());
    }

    /** Runs every check against one nomination. Pure - touches no state. */
    public List<NominationFlag> tag(Nomination nomination, List<Nomination> allNominations) {
        List<NominationFlag> flags = new ArrayList<>();

        for (NominationCheck check : checks) {
            try {
                check.evaluate(nomination, allNominations)
                        .map(reason -> new NominationFlag(check.flag(), FlagSource.RULE, reason))
                        .ifPresent(flags::add);
            } catch (RuntimeException e) {
                // One badly-behaved check must not cost the nomination the other
                // five flags, nor block a submission. Log it and carry on.
                log.error("Check {} threw for nomination {} - skipping that check only.",
                        check.getClass().getSimpleName(), nomination.getId(), e);
            }
        }

        return flags;
    }

    /**
     * Recomputes rule flags for every nomination on record. Called after each
     * submission, and exposed to coordinators so they can force a pass after the
     * rules themselves change.
     *
     * @return how many nominations came out carrying at least one rule flag
     */
    @Transactional
    public int retagAll() {
        List<Nomination> all = repository.findAll();

        int flaggedCount = 0;
        for (Nomination nomination : all) {
            List<NominationFlag> preservedAiFlags = nomination.getAiFlags().stream()
                    .filter(f -> f.getSource() == FlagSource.AI)
                    .toList();

            List<NominationFlag> ruleFlags = tag(nomination, all);

            List<NominationFlag> merged = new ArrayList<>(ruleFlags);
            merged.addAll(preservedAiFlags);
            nomination.setAiFlags(merged);

            if (!ruleFlags.isEmpty()) {
                flaggedCount++;
            }
        }

        repository.saveAll(all);
        log.info("Retagged {} nominations; {} carry at least one rule flag.", all.size(), flaggedCount);
        return flaggedCount;
    }
}
