package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.AiFlag;
import com.version1.recognition.nomination.Nomination;

import java.util.List;
import java.util.Optional;

/**
 * One independent question asked of one nomination.
 * <p>
 * Every check answers a single yes/no and, when the answer is yes, says why in
 * words a coordinator can read. Checks know nothing about each other and nothing
 * about how they are run: {@link com.version1.recognition.nomination.TaggingService}
 * collects every implementation Spring can find and runs the lot, so adding a
 * seventh rule means adding one class and nothing else.
 * <p>
 * All six current implementations are plain data checks - string matching, email
 * comparison, date arithmetic. None of them call a model. That is deliberate:
 * they are cheap, they are deterministic, and they still work when the AI
 * evaluator is unavailable. {@code WeakJustificationCheck} and
 * {@code RoutineLanguageCheck} are the two that could reasonably be swapped for
 * a model-backed version later, and because the swap happens behind this
 * interface, nothing else in the application would need to change.
 */
public interface NominationCheck {

    /** The flag this check raises. One check raises exactly one kind of flag. */
    AiFlag flag();

    /**
     * @param nomination      the nomination under test
     * @param allNominations  every nomination on record, for the checks that need
     *                        context - "did they nominate each other", "was this
     *                        person also nominated last quarter". Implementations
     *                        must skip {@code nomination} itself when scanning
     *                        this list.
     * @return the reason the flag was raised, or empty if the check passes
     */
    Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations);
}
