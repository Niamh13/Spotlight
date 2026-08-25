package com.version1.recognition.nomination.evaluation;

import com.version1.recognition.nomination.model.AiFlag;
import java.util.List;

public class AiEvaluationResult {

    private final Integer score;
    private final String rationale;
    private final List<AiFlag> flags;
    private final String promptVersion;

    public AiEvaluationResult(Integer score, String rationale, List<AiFlag> flags, String promptVersion) {
        this.score = score;
        this.rationale = rationale;
        this.flags = flags;
        this.promptVersion = promptVersion;
    }

    public Integer getScore() {
        return score;
    }

    public String getRationale() {
        return rationale;
    }

    public List<AiFlag> getFlags() {
        return flags;
    }

    public String getPromptVersion() {
        return promptVersion;
    }
}
