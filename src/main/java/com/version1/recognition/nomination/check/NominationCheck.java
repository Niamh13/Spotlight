package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import java.util.List;
import java.util.Optional;

/**
 * One rule, one question, one flag.
 *
 * <p>Implementations know nothing about each other or about how they get run.
 * TaggingService picks up every one Spring can find, so a new rule is a new
 * class and nothing else changes.
 *
 * <p>None of the current six call a model - they're string matching, email
 * comparison and date arithmetic. That keeps them fast, predictable, and
 * working when the AI is unavailable.
 */
public interface NominationCheck {

    /** The flag this check raises. One check, one kind of flag. */
    AiFlag flag();

    /**
     * @param nomination     the one being checked
     * @param allNominations everything on record, for the rules that need
     *                       context ("did they nominate each other?").
     *                       Implementations must skip {@code nomination} itself.
     * @return why the flag was raised, or empty if the check passes
     */
    Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations);
}
