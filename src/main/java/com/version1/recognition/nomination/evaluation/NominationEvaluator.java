package com.version1.recognition.nomination.evaluation;

import com.version1.recognition.nomination.model.Nomination;


/**
 * Scores a nomination and explains the score.
 *
 * <p>Implementations must throw {@link AiEvaluationException} on any failure -
 * timeout, bad response, missing key - rather than letting something else
 * escape. NominationService relies on that to fall back gracefully instead of
 * blocking the submission.
 */
public interface NominationEvaluator {

    /** Whether this evaluator can actually run right now (e.g. has a key). */
    boolean isAvailable();

    AiEvaluationResult evaluate(Nomination nomination) throws AiEvaluationException;
}
