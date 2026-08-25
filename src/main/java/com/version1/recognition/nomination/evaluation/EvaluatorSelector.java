package com.version1.recognition.nomination.evaluation;

import com.version1.recognition.nomination.model.Nomination;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Decides which evaluator runs: Groq if a key is configured, the mock if not.
 *
 * <p>The key can't live in the repository, so anyone cloning this starts
 * without one. Before this existed, that meant every nomination came back
 * SKIPPED_NO_API_KEY with no score and an empty AI Review screen - which reads
 * as a broken build rather than a missing credential. Falling back to the mock
 * means a fresh clone works immediately and gets the real model the moment a
 * key appears.
 *
 * <p>{@code ai.evaluator} overrides the choice: {@code auto} (default),
 * {@code groq} to force the real one, {@code mock} to force the offline one
 * even when a key exists - handy for tests, where a network call would be slow
 * and non-deterministic.
 */
@Component
@Primary
public class EvaluatorSelector implements NominationEvaluator {

    private static final Logger log = LoggerFactory.getLogger(EvaluatorSelector.class);

    private final GroqNominationEvaluator groq;
    private final MockNominationEvaluator mock;
    private final String mode;

    public EvaluatorSelector(GroqNominationEvaluator groq,
                              MockNominationEvaluator mock,
                              @Value("${ai.evaluator:auto}") String mode) {
        this.groq = groq;
        this.mock = mock;
        this.mode = mode == null ? "auto" : mode.trim().toLowerCase();
    }

    /**
     * Resolved per call, not cached. The key arrives via a property placeholder,
     * and pinning the decision before the context has finished refreshing is the
     * sort of thing that works on your machine and puzzles everyone else.
     */
    private NominationEvaluator active() {
        if ("mock".equals(mode)) {
            return mock;
        }
        if ("groq".equals(mode)) {
            return groq;
        }
        return groq.isAvailable() ? groq : mock;
    }

    /**
     * True whenever something can evaluate - in {@code auto} mode, always,
     * because the mock needs nothing. That's the point: a missing key becomes a
     * downgrade rather than an error.
     */
    @Override
    public boolean isAvailable() {
        return active().isAvailable();
    }

    @Override
    public AiEvaluationResult evaluate(Nomination nomination) throws AiEvaluationException {
        return active().evaluate(nomination);
    }

    /** Which evaluator is in play, for the startup banner and diagnostics. */
    public String describeActive() {
        NominationEvaluator chosen = active();
        if (chosen == groq) {
            return "Groq (live model)";
        }
        return groq.isAvailable() || "mock".equals(mode)
                ? "mock (rule-of-thumb, no network)"
                : "mock (rule-of-thumb, no network) - no GROQ_API_KEY set";
    }

    /** Logs which evaluator is in play. Called once at startup. */
    public void logSelection() {
        log.info("AI evaluator: {} [ai.evaluator={}]", describeActive(), mode);
        if (active() == mock && !"mock".equals(mode)) {
            log.info("No GROQ_API_KEY found, so nominations are scored by the built-in mock "
                    + "evaluator. Set GROQ_API_KEY and restart for real model evaluation.");
        }
    }
}
