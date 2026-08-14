package com.version1.recognition.nomination;

import java.util.Collections;
import java.util.List;

/**
 * The outcome of evaluating one nomination for completeness.
 * <p>
 * Not persisted. The evaluation is a pure function of the nomination's own
 * fields, so it is recomputed on read rather than stored - that keeps it from
 * going stale if the criteria are tuned, which they will be (see
 * {@link NominationEvaluator}).
 */
public class NominationEvaluation {

    private final List<EvaluationCriterion> failingCriteria;

    public NominationEvaluation(List<EvaluationCriterion> failingCriteria) {
        this.failingCriteria = List.copyOf(failingCriteria);
    }

    public static NominationEvaluation complete() {
        return new NominationEvaluation(Collections.emptyList());
    }

    public List<EvaluationCriterion> getFailingCriteria() {
        return failingCriteria;
    }

    /** True when nothing failed - the nomination is ready for review as-is. */
    public boolean isComplete() {
        return failingCriteria.isEmpty();
    }

    /**
     * True when the evaluation found missing or insufficient information, which
     * is the condition this story's acceptance criteria hang off.
     */
    public boolean flagsIncompleteInformation() {
        return !failingCriteria.isEmpty();
    }
}
