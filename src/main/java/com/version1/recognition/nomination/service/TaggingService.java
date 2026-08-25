package com.version1.recognition.nomination.service;

import com.version1.recognition.nomination.check.NominationCheck;
import com.version1.recognition.nomination.model.FlagSource;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.NominationFlag;
import com.version1.recognition.nomination.repository.NominationRepository;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs every {@link NominationCheck} and collects the flags.
 *
 * <p>No logic here beyond "run them all" - that's the point. Spring injects
 * every check it finds, so a seventh rule means a seventh class and no edit
 * here.
 *
 * <p><b>Why a submission retags everything.</b> Reciprocal and repeat-quarter
 * depend on the other nominations, so their answer changes as new ones arrive.
 * If A nominates B on Monday and B nominates A on Tuesday, tagging only the new
 * one would flag Tuesday's and leave Monday's clean - backwards from what a
 * coordinator needs to see.
 *
 * <p>Retagging replaces RULE flags and keeps AI ones. Rule flags can be
 * recalculated; an AI flag is what a model said once and can't be reproduced.
 *
 * <p><b>Known limit.</b> retagAll is O(n²) - every nomination checked against
 * every other - and it runs on every submission. Fine at demo scale, not fine
 * at the ~300/week the brief describes. The fix is to retag only what could
 * have changed (the other half of a reciprocal pair, the same nominee's
 * previous quarter) rather than the whole table.
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
     * Recomputes rule flags across every nomination. Runs after each submission,
     * and is exposed to coordinators for the case where the rules themselves
     * changed and nothing new has been submitted to trigger a pass.
     *
     * @return how many nominations ended up with at least one rule flag
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

            // Same overlap on the way back in: keep the AI's flag only where no
            // rule raised it this time round.
            List<NominationFlag> merged = new ArrayList<>(ruleFlags);
            preservedAiFlags.stream()
                    .filter(ai -> ruleFlags.stream().noneMatch(r -> r.getFlag() == ai.getFlag()))
                    .forEach(merged::add);
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
