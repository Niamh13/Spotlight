package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.Nomination;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Does the write-up lean on generic praise and job-description language instead
 * of describing something specific?
 * <p>
 * Two families of phrase are looked for. The first is <em>routine duty</em> -
 * "completed on time", "attended", "closed tickets" - which describes someone
 * meeting the normal expectations of their role, not exceeding them; a Star
 * Award is explicitly for going beyond. The second is <em>generic praise</em> -
 * "team player", "great teammate" - which is warm but unreviewable, because it
 * names a quality rather than a thing that happened.
 * <p>
 * Phrase matching is blunt and will occasionally catch a good nomination that
 * happens to use one of these turns of phrase alongside real substance. That is
 * why this raises an advisory flag with the matched phrases quoted, rather than
 * scoring or blocking anything: the coordinator can see exactly what tripped it
 * and wave it through in a second. Like {@link WeakJustificationCheck}, this is
 * a reasonable candidate to replace with a model-backed judgement later.
 */
@Component
@Order(50)
public class RoutineLanguageCheck implements NominationCheck {

    /** Describes meeting the normal expectations of the job. */
    private static final List<String> ROUTINE_DUTY = List.of(
            "completed on time", "completed the task", "completed all tasks",
            "attended", "showed up", "turned up",
            "responded to emails", "answered emails", "replied to emails",
            "closed tickets", "closed all tickets", "cleared the backlog",
            "did their job", "does their job", "did his job", "did her job",
            "met the deadline", "met all deadlines", "on time and on budget");

    /** Warm but unreviewable - a quality, not an event. */
    private static final List<String> GENERIC_PRAISE = List.of(
            "team player", "great teammate", "good teammate",
            "always helpful", "very helpful", "so helpful",
            "good job", "great job", "nice work", "well done",
            "hard worker", "works hard", "hard working",
            "a pleasure to work with", "lives the values", "brilliant to work with",
            "helped out a lot", "always available", "goes above and beyond");

    @Override
    public AiFlag flag() {
        return AiFlag.ROUTINE_TASK_LANGUAGE;
    }

    @Override
    public Optional<String> evaluate(Nomination nomination, List<Nomination> allNominations) {
        String what = nomination.getWhatText() == null ? "" : nomination.getWhatText();
        String how = nomination.getHowText() == null ? "" : nomination.getHowText();
        String lower = (what + " " + how).toLowerCase(Locale.ROOT);

        List<String> routine = matches(ROUTINE_DUTY, lower);
        List<String> generic = matches(GENERIC_PRAISE, lower);

        if (routine.isEmpty() && generic.isEmpty()) {
            return Optional.empty();
        }

        StringBuilder reason = new StringBuilder();
        if (!routine.isEmpty()) {
            reason.append("Describes routine duties rather than contribution beyond the role: ")
                  .append(quote(routine)).append(". ");
        }
        if (!generic.isEmpty()) {
            reason.append("Uses generic praise in place of a specific example: ")
                  .append(quote(generic)).append(". ");
        }
        reason.append("Worth asking for a concrete example before deciding.");

        return Optional.of(reason.toString());
    }

    private List<String> matches(List<String> phrases, String haystack) {
        return phrases.stream().filter(haystack::contains).collect(Collectors.toList());
    }

    private String quote(List<String> phrases) {
        return phrases.stream().map(p -> "\"" + p + "\"").collect(Collectors.joining(", "));
    }
}
