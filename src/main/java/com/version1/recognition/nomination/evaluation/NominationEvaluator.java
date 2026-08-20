package com.version1.recognition.nomination.evaluation;

import com.version1.recognition.nomination.Nomination;
import com.version1.recognition.nomination.NominationService;

/**
 * Judges the two language-quality signals (routine-task language, weak
 * justification) and produces a score + rationale for the coordinator.
 * <p>
 * Implementations must throw {@link AiEvaluationException} on any failure
 * (timeout, bad response, missing key) rather than let a raw exception
 * escape - {@link NominationService} relies on that to implement the
 * fallback behavior instead of blocking submission.
 */
public interface NominationEvaluator {

    /** True if this evaluator is actually usable right now (e.g. an API key is configured). */
    boolean isAvailable();

    AiEvaluationResult evaluate(Nomination nomination) throws AiEvaluationException;
}
