package com.version1.recognition.nomination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Picks which evaluator actually runs, so the application works on a fresh
 * clone with no configuration at all.
 * <p>
 * The problem this solves: the Groq key can't live in the repository, so anyone
 * cloning this starts without one. Wiring Groq in unconditionally meant every
 * nomination they submitted came back {@code SKIPPED_NO_API_KEY} with no score,
 * and the AI Review screen sat empty - which looks like a broken build rather
 * than an absent credential.
 * <p>
 * So: if a Groq key is present, use Groq. If not, fall back to the mock
 * evaluator, which needs nothing and still produces scores, rationales and
 * flags. A cloner gets a working, demonstrable application immediately, and
 * gets the real thing the moment they export {@code GROQ_API_KEY}.
 *
 * <h2>Overriding</h2>
 * {@code ai.evaluator} controls this:
 * <ul>
 *   <li>{@code auto} (default) - Groq if a key is configured, mock otherwise</li>
 *   <li>{@code groq} - always Groq; nominations report the evaluation as
 *       skipped if no key is set, rather than quietly using the mock</li>
 *   <li>{@code mock} - always the mock, even when a key is available. Useful in
 *       tests and demos where an outbound call would be slow or non-deterministic</li>
 * </ul>
 * Marked {@link Primary} so it is what gets injected wherever a
 * {@link NominationEvaluator} is asked for; the two concrete evaluators remain
 * available as beans in their own right.
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
     * Resolved per call rather than cached at startup. The key is read through a
     * property placeholder, and holding on to a decision made before the context
     * finished refreshing is the kind of thing that works locally and confuses
     * everyone later.
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
     * True whenever something can evaluate. In {@code auto} mode that is always,
     * because the mock needs nothing - which is the point: a missing key stops
     * being an error condition and becomes a downgrade.
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

    void logSelection() {
        log.info("AI evaluator: {} [ai.evaluator={}]", describeActive(), mode);
        if (active() == mock && !"mock".equals(mode)) {
            log.info("No GROQ_API_KEY found, so nominations are scored by the built-in mock "
                    + "evaluator. Set GROQ_API_KEY and restart for real model evaluation.");
        }
    }
}
