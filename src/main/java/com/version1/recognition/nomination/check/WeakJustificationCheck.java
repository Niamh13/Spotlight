package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.Nomination;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Scores the write-up on three cheap signals and flags it when two or more fire:
 * <ol>
 *   <li>it is short - under 150 characters across WHAT and HOW together;</li>
 *   <li>it contains no figures at all - no hours saved, no percentage, no count;</li>
 *   <li>it names none of the six company values.</li>
 * </ol>
 * Two of three, rather than any one, because each signal on its own has honest
 * exceptions: a short write-up that quantifies its impact and names a value is
 * fine, and plenty of genuine contributions have no number attached to them.
 * Requiring two makes the flag mean "thin on several fronts at once", which is
 * the thing actually worth a coordinator's attention.
 * <p>
 * This is deliberately mechanical - it measures the shape of the text, not its
 * meaning, and it will happily pass a well-padded piece of nonsense. It is the
 * obvious candidate to swap for a model-backed judgement later; because it sits
 * behind {@link NominationCheck}, that swap touches this file only.
 */
@Component
@Order(40)
public class WeakJustificationCheck implements NominationCheck {

    private static final int SHORT_THRESHOLD = 150;
    private static final Pattern CONTAINS_DIGIT = Pattern.compile("\\d");

    @Override
    public AiFlag flag() {
        return AiFlag.WEAK_JUSTIFICATION;
    }

    @Override
    public Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations) {
        String what = nomination.getWhatText() == null ? "" : nomination.getWhatText();
        String how = nomination.getHowText() == null ? "" : nomination.getHowText();
        String combined = (what + " " + how).trim();
        String lower = combined.toLowerCase(Locale.ROOT);

        List<String> failures = new ArrayList<>();

        if (combined.length() < SHORT_THRESHOLD) {
            failures.add("it runs to only " + combined.length() + " characters across WHAT and HOW "
                    + "(under " + SHORT_THRESHOLD + ")");
        }

        if (!CONTAINS_DIGIT.matcher(combined).find()) {
            failures.add("it gives no figures - no time saved, count or percentage to show the scale "
                    + "of the impact");
        }

        // The form asks for the value in prose, so this asks whether the
        // write-up names one at all. A blunt proxy - someone can describe No Ego
        // perfectly without using the phrase - so the reason says exactly what
        // was looked for and a coordinator can wave it through.
        if (CoreValue.detectIn(combined).isEmpty()) {
            failures.add("it names none of the six core values, and nothing in the wording "
                    + "clearly points at one");
        }

        if (failures.size() < 2) {
            return Optional.empty();
        }

        return Optional.of("Thin on " + failures.size() + " of 3 signals: "
                + String.join("; ", failures) + ".");
    }
}
