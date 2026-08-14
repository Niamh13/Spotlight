package com.version1.recognition.nomination;

import java.util.List;

/**
 * Outbound view of an evaluation. Each failing criterion is sent as code + gap
 * + remedy so a client can render the same list the message contains without
 * hard-coding the wording.
 */
public class EvaluationResponse {

    private final boolean complete;
    private final List<CriterionView> failingCriteria;

    public EvaluationResponse(NominationEvaluation evaluation) {
        this.complete = evaluation.isComplete();
        this.failingCriteria = evaluation.getFailingCriteria().stream()
                .map(CriterionView::new)
                .toList();
    }

    public boolean isComplete() {
        return complete;
    }

    public List<CriterionView> getFailingCriteria() {
        return failingCriteria;
    }

    public static class CriterionView {
        private final String code;
        private final String gap;
        private final String remedy;

        public CriterionView(EvaluationCriterion criterion) {
            this.code = criterion.name();
            this.gap = criterion.getGap();
            this.remedy = criterion.getRemedy();
        }

        public String getCode() {
            return code;
        }

        public String getGap() {
            return gap;
        }

        public String getRemedy() {
            return remedy;
        }
    }
}
