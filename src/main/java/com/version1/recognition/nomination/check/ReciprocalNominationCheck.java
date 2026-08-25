package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Did the nominee also nominate the nominator, somewhere else on record?
 * "You scratch my back, I'll scratch yours."
 * <p>
 * Note this says nothing about whether either nomination is deserved - two people
 * who worked closely on the same difficult thing have an obvious honest reason to
 * nominate each other. The flag exists so a coordinator sees the pairing and
 * decides, not so the pairing is treated as misconduct.
 */
@Component
@Order(20)
public class ReciprocalNominationCheck implements NominationCheck {

    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("d MMM yyyy").withZone(ZoneOffset.UTC);

    @Override
    public AiFlag flag() {
        return AiFlag.RECIPROCAL_NOMINATION;
    }

    @Override
    public Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations) {
        return allNominations.stream()
                .filter(other -> !isSameRecord(other, nomination))
                .filter(other -> emailsMatch(other.getNominatorEmail(), nomination.getNomineeEmail()))
                .filter(other -> emailsMatch(other.getNomineeEmail(), nomination.getNominatorEmail()))
                .findFirst()
                .map(other -> nomination.getNomineeName() + " also nominated "
                        + nomination.getNominatorName() + " on "
                        + (other.getSubmittedAt() == null ? "an earlier date" : DATE.format(other.getSubmittedAt()))
                        + ". The two nominations point at each other.");
    }

    /**
     * Guards against a nomination matching itself. Ids are null for a record that
     * hasn't been persisted yet, so fall back to identity in that case rather
     * than letting a null-vs-null comparison call every unsaved row "the same".
     */
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
