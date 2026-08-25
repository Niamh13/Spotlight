package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Is the nominee a known user in the platform's own directory?
 * <p>
 * This is a narrower question than "is this person an active employee" - the
 * directory is only ever as complete as whoever has been seeded or created
 * here, not a live HR feed (Workday, an AD group, a starters-and-leavers
 * feed). Absence from this table is a signal worth a coordinator's
 * attention, not proof someone has left, so - like every other check in this
 * package - it raises {@link AiFlag#NOMINEE_NOT_ACTIVE_EMPLOYEE} as an
 * advisory flag and never blocks the submission itself. See
 * NominationService.submit() for why identity checks stay advisory rather
 * than hard-blocking: the directory only has a handful of seeded rows, and
 * hard-blocking on it would mean nobody outside those rows could ever be
 * nominated.
 */
@Component
@Order(60)
public class EmployeeStatusCheck implements NominationCheck {

    private final UserRepository userRepository;

    public EmployeeStatusCheck(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public AiFlag flag() {
        return AiFlag.NOMINEE_NOT_ACTIVE_EMPLOYEE;
    }

    @Override
    public Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations) {
        String nomineeEmail = nomination.getNomineeEmail();
        if (nomineeEmail == null || nomineeEmail.isBlank()) {
            return Optional.empty();
        }

        boolean known = userRepository.findByEmailIgnoreCase(nomineeEmail.trim()).isPresent();
        if (known) {
            return Optional.empty();
        }

        return Optional.of("No record of " + nomineeEmail + " in the user directory - "
                + "double check this is the right address before deciding.");
    }
}
