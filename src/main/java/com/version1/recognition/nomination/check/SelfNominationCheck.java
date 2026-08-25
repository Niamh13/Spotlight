package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import java.util.List;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Is the nominator the same person as the nominee?
 * <p>
 * Submission already rejects an exact email match outright, so in normal running
 * this check is a backstop rather than the primary defence. It earns its place on
 * the name comparison: someone nominating themselves from a personal address, or
 * a record imported from the old spreadsheet where no such rule ever applied,
 * gets caught here instead of reaching a coordinator unmarked.
 */
@Component
@Order(10)
public class SelfNominationCheck implements NominationCheck {

    @Override
    public AiFlag flag() {
        return AiFlag.SELF_NOMINATION;
    }

    @Override
    public Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations) {
        if (matches(nomination.getNominatorEmail(), nomination.getNomineeEmail())) {
            return Optional.of("Nominator and nominee have the same email address ("
                    + nomination.getNominatorEmail() + ").");
        }

        if (matches(nomination.getNominatorName(), nomination.getNomineeName())) {
            return Optional.of("Nominator and nominee have the same name (\""
                    + nomination.getNominatorName() + "\") on different email addresses - "
                    + "either a self-nomination from a second address, or two colleagues who "
                    + "genuinely share a name. Worth a look either way.");
        }

        return Optional.empty();
    }

    private boolean matches(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }
}
