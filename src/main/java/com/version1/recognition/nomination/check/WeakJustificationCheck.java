package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.AiFlag;
import com.version1.recognition.nomination.CoreValue;
import com.version1.recognition.nomination.Nomination;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

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

    // Distinctive words from each core value's name, used to spot whether the
    // HOW is visibly about the value the nominator picked.
    private static final Map<CoreValue, List<String>> VALUE_KEYWORDS = Map.of(
            CoreValue.HONESTY_AND_INTEGRITY, List.of("honest", "integrity", "truthful", "transparent"),
            CoreValue.PERSONAL_COMMITMENT, List.of("commit", "dependable", "reliable", "followed through", "saw it through"),
            CoreValue.NO_EGO, List.of("ego", "credit", "owned", "own mistake", "shared the", "humble"),
            CoreValue.CUSTOMER_FIRST, List.of("customer", "client"),
            CoreValue.EXCELLENCE, List.of("excellence", "root cause", "no stone", "thorough", "rigorous", "quality"),
            CoreValue.DRIVE, List.of("drive", "drove", "initiative", "unprompted", "off their own", "pushed"));

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

        // Now that the value is picked from a list, "did they name a value" is
        // answered by the form. The useful question is whether the HOW actually
        // argues for the value chosen, or just sits next to it. This is a blunt
        // proxy - a good HOW can evidence No Ego without using the word - so the
        // matched-or-not reasoning is spelled out in the message and a
        // coordinator can dismiss it at a glance.
        CoreValue chosen = nomination.getCoreValue();
        if (chosen == null) {
            failures.add("no core value was selected");
        } else {
            List<String> keywords = VALUE_KEYWORDS.getOrDefault(chosen, List.of());
            boolean touchesValue = keywords.stream().anyMatch(lower::contains);
            if (!touchesValue) {
                failures.add("the HOW never visibly connects to " + chosen.getLabel()
                        + ", the value the nominator selected");
            }
        }

        if (failures.size() < 2) {
            return Optional.empty();
        }

        return Optional.of("Thin on " + failures.size() + " of 3 signals: "
                + String.join("; ", failures) + ".");
    }
}
