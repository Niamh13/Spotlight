package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import java.util.List;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Is the nominee still an active employee?
 * <p>
 * <b>Placeholder - always passes.</b> Answering this needs an HR source of truth
 * (Workday, an AD group, a starters-and-leavers feed) and there isn't one wired
 * up yet. Rather than guess from the email domain - which would quietly mark
 * contractors and anyone mid-domain-migration as leavers - it returns empty
 * every time and is honest about why.
 * <p>
 * It ships now rather than later so the shape of the answer is already agreed:
 * when the HR feed arrives, this file gets a client injected and a lookup in
 * {@link #evaluate}, and nothing else in the application changes. The flag it
 * would raise, {@link AiFlag#NOMINEE_NOT_ACTIVE_EMPLOYEE}, already exists and is
 * already rendered by the dashboard.
 */
@Component
@Order(60)
public class EmployeeStatusCheck implements NominationCheck {

    @Override
    public AiFlag flag() {
        return AiFlag.NOMINEE_NOT_ACTIVE_EMPLOYEE;
    }

    @Override
    public Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations) {
        // No HR data source yet - see the class comment. Deliberately not
        // guessing from the email domain.
        return Optional.empty();
    }
}
