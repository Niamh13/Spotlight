package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.Quarter;
import java.util.List;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Was this same person also nominated in the immediately preceding quarter?
 * <p>
 * Catches the "same favourite every time" pattern - one manager putting the same
 * name forward quarter after quarter while the rest of a team never appears.
 * Deliberately scoped to the <em>immediately</em> preceding quarter rather than
 * "ever before": someone recognised twice in two years is not a pattern, and
 * flagging them would train coordinators to ignore this flag.
 */
@Component
@Order(30)
public class RepeatNominationCheck implements NominationCheck {

    @Override
    public AiFlag flag() {
        return AiFlag.REPEAT_NOMINATION_CONSECUTIVE_QUARTER;
    }

    @Override
    public Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations) {
        if (nomination.getSubmittedAt() == null || nomination.getNomineeEmail() == null) {
            return Optional.empty();
        }

        Quarter previous = Quarter.of(nomination.getSubmittedAt()).previous();

        return allNominations.stream()
                .filter(other -> !isSameRecord(other, nomination))
                .filter(other -> other.getSubmittedAt() != null)
                .filter(other -> emailsMatch(other.getNomineeEmail(), nomination.getNomineeEmail()))
                .filter(other -> previous.contains(other.getSubmittedAt()))
                .findFirst()
                .map(other -> nomination.getNomineeName() + " was also nominated in "
                        + previous.label() + ", by " + other.getNominatorName()
                        + ". Two consecutive quarters for the same person.");
    }

    private boolean isSameRecord(Nomination a, Nomination b) {
        if (a.getId() != null && b.getId() != null) {
            return a.getId().equals(b.getId());
        }
        return a == b;
    }

    private boolean emailsMatch(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }

}
