package com.version1.recognition.nomination;

import com.version1.recognition.nomination.evaluation.EvaluatorSelector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Runs one rule-flag pass at startup.
 * <p>
 * Rule flags are derived data - they are whatever the current checks say about
 * the current rows - so recomputing them on boot keeps them honest after a
 * migration, a seed load, or a change to the rules themselves. Without this, a
 * freshly-seeded database would sit there showing no flags at all until somebody
 * happened to submit a nomination, which reads as "nothing wrong with any of
 * these" rather than "nobody has looked yet".
 * <p>
 * Only {@link FlagSource#RULE} flags are touched; AI flags are preserved.
 */
@Component
public class TaggingStartupRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(TaggingStartupRunner.class);

    private final TaggingService taggingService;
    private final EvaluatorSelector evaluatorSelector;

    public TaggingStartupRunner(TaggingService taggingService, EvaluatorSelector evaluatorSelector) {
        this.taggingService = taggingService;
        this.evaluatorSelector = evaluatorSelector;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Says which evaluator is live, so someone running this for the first
        // time can tell "mock scores because no key" from "something is broken".
        evaluatorSelector.logSelection();

        try {
            int flagged = taggingService.retagAll();
            log.info("Startup tagging pass complete - {} nomination(s) carry at least one rule flag.", flagged);
        } catch (RuntimeException e) {
            // Tagging is advisory. A failure here must not stop the application
            // from starting and serving the review queue.
            log.error("Startup tagging pass failed - flags may be stale until the next submission "
                    + "or an explicit POST /api/nominations/retag.", e);
        }
    }
}
