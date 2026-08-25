package com.version1.recognition.nomination.evaluation;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Rule-of-thumb stand-in for the real Groq evaluator (see
 * GroqNominationEvaluator) - no API key, no network call, always
 * available. {@link EvaluatorSelector} falls back to this whenever no
 * GROQ_API_KEY is configured, so a fresh clone runs end to end with zero
 * setup and still produces scores, rationales and flags. Deliberately
 * simple: it's a fallback, not a second real implementation to maintain
 * in parallel.
 */
@Component
public class MockNominationEvaluator implements NominationEvaluator {

    private static final String PROMPT_VERSION = "mock";
    private static final List<String> ROUTINE_PHRASES = List.of(
            "attended", "completed on time", "responded to emails", "closed tickets", "showed up");
    private static final List<String> WEAK_PHRASES = List.of(
            "great teammate", "always helpful", "good job", "nice work", "team player");

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public AiEvaluationResult evaluate(Nomination nomination) {
        List<AiFlag> flags = new ArrayList<>();
        String what = nomination.getWhatText().toLowerCase();
        String how = nomination.getHowText().toLowerCase();

        boolean routine = ROUTINE_PHRASES.stream().anyMatch(what::contains);
        boolean weak = WEAK_PHRASES.stream().anyMatch(how::contains) || how.trim().split("\\s+").length < 8;

        if (routine) flags.add(AiFlag.ROUTINE_TASK_LANGUAGE);
        if (weak) flags.add(AiFlag.WEAK_JUSTIFICATION);

        int score = 85 - (routine ? 25 : 0) - (weak ? 25 : 0);
        String rationale = flags.isEmpty()
                ? "No language concerns detected by the mock evaluator."
                : "Mock evaluator flagged: " + flags + ". Replace with the real Groq evaluator for actual judgment.";

        return new AiEvaluationResult(score, rationale, flags, PROMPT_VERSION);
    }
}
