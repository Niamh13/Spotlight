package com.version1.recognition.nomination.evaluation;

import com.version1.recognition.nomination.Nomination;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The mode x groq-availability decision table documented in EvaluatorSelector's
 * javadoc: auto picks Groq when available and falls back to the mock otherwise;
 * "mock"/"groq" force a specific evaluator regardless of availability.
 */
@ExtendWith(MockitoExtension.class)
class EvaluatorSelectorTest {

    @Mock
    private GroqNominationEvaluator groq;

    @Mock
    private MockNominationEvaluator mockEvaluator;

    @Test
    @DisplayName("auto mode, groq available -> groq is active")
    void auto_groqAvailable_usesGroq() {
        lenient().when(groq.isAvailable()).thenReturn(true);

        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, "auto");

        assertThat(selector.isAvailable()).isTrue();
        assertThat(selector.describeActive()).isEqualTo("Groq (live model)");
        verify(mockEvaluator, never()).isAvailable();
    }

    @Test
    @DisplayName("auto mode, groq unavailable -> falls back to mock")
    void auto_groqUnavailable_fallsBackToMock() {
        when(groq.isAvailable()).thenReturn(false);
        // The mock evaluator is genuinely always-available in production (no
        // network call needed); a bare Mockito mock defaults booleans to false,
        // so this must be stubbed explicitly to reflect real behavior.
        when(mockEvaluator.isAvailable()).thenReturn(true);

        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, "auto");

        assertThat(selector.isAvailable()).isTrue();
        assertThat(selector.describeActive()).contains("mock").contains("no GROQ_API_KEY set");
    }

    @Test
    @DisplayName("mock mode forces the mock even when groq is available")
    void mockMode_forcesMock_evenWhenGroqAvailable() {
        // describeActive()'s message-selection branch reads groq.isAvailable()
        // even when the active evaluator is the mock (it decides which of the
        // two "mock" messages to show), so that call happening is expected here
        // - not something to assert "never" on.
        lenient().when(groq.isAvailable()).thenReturn(true);

        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, "mock");

        assertThat(selector.describeActive()).isEqualTo("mock (rule-of-thumb, no network)");
    }

    @Test
    @DisplayName("mock mode forces the mock when groq is unavailable too")
    void mockMode_forcesMock_whenGroqUnavailable() {
        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, "mock");

        assertThat(selector.describeActive()).isEqualTo("mock (rule-of-thumb, no network)");
    }

    @Test
    @DisplayName("groq mode forces groq even when it reports unavailable")
    void groqMode_forcesGroq_evenWhenUnavailable() {
        when(groq.isAvailable()).thenReturn(false);

        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, "groq");

        assertThat(selector.isAvailable()).isFalse();
        assertThat(selector.describeActive()).isEqualTo("Groq (live model)");
        verify(mockEvaluator, never()).isAvailable();
    }

    @Test
    @DisplayName("evaluate() delegates to whichever evaluator is active")
    void evaluateDelegatesToActiveEvaluator() throws AiEvaluationException {
        when(groq.isAvailable()).thenReturn(true);
        Nomination nomination = mock(Nomination.class);
        AiEvaluationResult expected = new AiEvaluationResult(80, "good", List.of(), "v1");
        when(groq.evaluate(nomination)).thenReturn(expected);

        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, "auto");

        assertThat(selector.evaluate(nomination)).isSameAs(expected);
    }

    @Test
    @DisplayName("null mode value defaults to auto")
    void nullMode_defaultsToAuto() {
        when(groq.isAvailable()).thenReturn(true);

        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, null);

        assertThat(selector.describeActive()).isEqualTo("Groq (live model)");
    }

    @Test
    @DisplayName("mode value is trimmed and case-insensitive")
    void modeIsTrimmedAndCaseInsensitive() {
        EvaluatorSelector selector = new EvaluatorSelector(groq, mockEvaluator, "  MOCK  ");

        assertThat(selector.describeActive()).isEqualTo("mock (rule-of-thumb, no network)");
    }
}
