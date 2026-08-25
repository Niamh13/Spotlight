package com.version1.recognition.nomination.check;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.AwardCategory;
import com.version1.recognition.nomination.model.CoreValue;
import com.version1.recognition.nomination.model.Nomination;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class RoutineLanguageCheckTest {

    private final RoutineLanguageCheck check = new RoutineLanguageCheck();

    private Nomination nomination(String what, String how) {
        return new Nomination(
                "Nominator", "nominator@example.com", "Nominee", "nominee@example.com",
                "Practice", "Location", AwardCategory.QUALITY_AND_COMPLIANCE,
                CoreValue.DRIVE, what, how, null);
    }

    @Test
    @DisplayName("flag() returns ROUTINE_TASK_LANGUAGE")
    void flagIsRoutineTaskLanguage() {
        assertThat(check.flag()).isEqualTo(AiFlag.ROUTINE_TASK_LANGUAGE);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "completed on time", "attended", "showed up", "closed tickets",
            "did their job", "met the deadline"
    })
    @DisplayName("routine-duty phrases in WHAT are matched")
    void routineDutyPhrasesInWhat_areMatched(String phrase) {
        Nomination n = nomination("They " + phrase + " this quarter.", "Nothing else to add.");

        Optional<String> result = check.evaluate(n, Collections.emptyList());

        assertThat(result).isPresent();
        assertThat(result.get()).contains("Describes routine duties");
        assertThat(result.get()).contains("\"" + phrase + "\"");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "team player", "great teammate", "always helpful", "good job",
            "hard worker", "goes above and beyond"
    })
    @DisplayName("generic-praise phrases in HOW are matched")
    void genericPraisePhrasesInHow_areMatched(String phrase) {
        Nomination n = nomination("They did something.", "Everyone says they're a " + phrase + ".");

        Optional<String> result = check.evaluate(n, Collections.emptyList());

        assertThat(result).isPresent();
        assertThat(result.get()).contains("Uses generic praise");
        assertThat(result.get()).contains("\"" + phrase + "\"");
    }

    @Test
    @DisplayName("both a routine-duty and a generic-praise phrase - both parts of the message appear")
    void bothCategoriesMatch_bothPartsInMessage() {
        Nomination n = nomination("They completed on time as always.", "Such a team player.");

        Optional<String> result = check.evaluate(n, Collections.emptyList());

        assertThat(result).isPresent();
        assertThat(result.get()).contains("Describes routine duties");
        assertThat(result.get()).contains("Uses generic praise");
    }

    @Test
    @DisplayName("matching is case-insensitive")
    void matchingIsCaseInsensitive() {
        Nomination n = nomination("THEY COMPLETED ON TIME.", "Nothing else.");

        assertThat(check.evaluate(n, Collections.emptyList())).isPresent();
    }

    @Test
    @DisplayName("text with neither phrase family - not flagged")
    void noMatchingPhrases_notFlagged() {
        Nomination n = nomination(
                "They redesigned the onboarding flow, cutting setup time from three days to under an hour.",
                "They mapped every failure point themselves, without being asked, and fixed each one.");

        Optional<String> result = check.evaluate(n, Collections.emptyList());

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("null WHAT/HOW does not throw and is treated as empty text")
    void nullTextDoesNotThrow() {
        Nomination n = nomination(null, null);

        assertThat(check.evaluate(n, Collections.emptyList())).isEmpty();
    }

    @Test
    @DisplayName("a phrase that happens to sit inside real substance still matches (documented limitation)")
    void bluntMatchingCanCatchGoodWriteups() {
        // The class javadoc explicitly accepts this: phrase matching is blunt and
        // will occasionally flag a nomination that has real substance alongside
        // one of these turns of phrase. This test documents that trade-off rather
        // than treating it as a bug - if RoutineLanguageCheck ever gets smarter
        // (e.g. requiring the phrase to be the whole sentence), this test should
        // be revisited.
        Nomination n = nomination(
                "Beyond their usual scope, they were always helpful with onboarding new hires, "
                        + "personally mentoring three people through a difficult migration.",
                "Went well beyond what was asked.");

        assertThat(check.evaluate(n, Collections.emptyList())).isPresent();
    }
}
