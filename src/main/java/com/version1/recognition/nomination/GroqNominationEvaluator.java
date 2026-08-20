package com.version1.recognition.nomination;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Calls Groq's free-tier API (OpenAI-compatible chat completions endpoint)
 * to judge routine-task language and weak justification, and produce a
 * score + rationale. Whether this or the mock actually runs is decided by
 * {@link EvaluatorSelector}: this one is used when a GROQ_API_KEY is configured.
 * <p>
 * The API key comes ONLY from the GROQ_API_KEY environment variable - set
 * it on your machine before running the app:
 *   export GROQ_API_KEY=gsk_...          (Mac/Linux)
 *   $env:GROQ_API_KEY = "gsk_..."         (Windows PowerShell)
 * It is never logged, never stored in the database, and never hardcoded here.
 */
@Component
public class GroqNominationEvaluator implements NominationEvaluator {

    private static final Logger log = LoggerFactory.getLogger(GroqNominationEvaluator.class);
    private static final String PROMPT_VERSION = "v1";
    private static final String API_URL = "https://api.groq.com/openai/v1/chat/completions";

    @Value("${groq.api.key:}")
    private String apiKey;

    // gpt-oss-20b is the smaller/faster of Groq's current general-purpose
    // models - this is a short classification task, not deep reasoning, so
    // it's the right fit for the free tier's rate limits. Override via
    // groq.api.model (e.g. openai/gpt-oss-120b) if you want more reasoning depth.
    @Value("${groq.api.model:openai/gpt-oss-20b}")
    private String model;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String promptTemplate;

    public GroqNominationEvaluator() {
        this.promptTemplate = loadPromptTemplate();
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public AiEvaluationResult evaluate(Nomination nomination) throws AiEvaluationException {
        String prompt = promptTemplate
                .replace("{{WHAT_TEXT}}", nomination.getWhatText())
                .replace("{{HOW_TEXT}}", nomination.getHowText());

        try {
            String requestBody = objectMapper.writeValueAsString(new GroqRequest(model, prompt));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new AiEvaluationException(
                        "Groq API returned status " + response.statusCode() + ": " + response.body(), null);
            }

            return parseResponse(response.body());

        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new AiEvaluationException("Failed to reach Groq API", e);
        }
    }

    private AiEvaluationResult parseResponse(String rawBody) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String modelText = root.path("choices").get(0).path("message").path("content").asText();

            // The model sometimes wraps JSON in ```json fences despite instructions -
            // strip those before parsing, rather than treating it as a hard failure.
            String cleaned = modelText.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```(json)?", "").replaceAll("```$", "").trim();
            }

            JsonNode evaluation = objectMapper.readTree(cleaned);

            Integer score = evaluation.path("score").isNumber() ? evaluation.get("score").asInt() : null;
            String rationale = evaluation.hasNonNull("rationale") ? evaluation.get("rationale").asText() : null;

            // A response can parse cleanly and still carry nothing usable - the model
            // declining to judge abusive or nonsense input is the common case, and it
            // answers with prose or an empty object rather than the agreed shape.
            // Without this, that lands in the database as COMPLETED with a null score,
            // which the dashboard renders as a blank assessment and a coordinator
            // reasonably reads as "the AI looked at it and had no concerns". Treat it
            // as a failed evaluation so the UI says so instead.
            if (score == null || rationale == null || rationale.isBlank()) {
                throw new AiEvaluationException(
                        "Groq returned no usable score or rationale - refusing to record an empty "
                                + "COMPLETED evaluation. Raw response: " + rawBody, null);
            }
            if (score < 0 || score > 100) {
                throw new AiEvaluationException(
                        "Groq returned a score outside 0-100 (" + score + ") - discarding it rather "
                                + "than showing a coordinator a number the scale doesn't support.", null);
            }

            List<AiFlag> flags = new ArrayList<>();
            if (evaluation.has("flags")) {
                for (JsonNode flagNode : evaluation.get("flags")) {
                    try {
                        flags.add(AiFlag.valueOf(flagNode.asText()));
                    } catch (IllegalArgumentException ignored) {
                        log.warn("Model returned unrecognized flag: {}", flagNode.asText());
                    }
                }
            }

            return new AiEvaluationResult(score, rationale, flags, PROMPT_VERSION);

        } catch (AiEvaluationException e) {
            // Already diagnosed above - don't bury the specific reason inside a
            // generic "couldn't parse" message.
            throw e;
        } catch (Exception e) {
            // Covers malformed JSON, unexpected shape, the model not following
            // the format instructions, etc. - all treated as an evaluation
            // failure, not a crash.
            throw new AiEvaluationException("Couldn't parse Groq API response: " + rawBody, e);
        }
    }

    private String loadPromptTemplate() {
        try {
            byte[] bytes = new ClassPathResource("prompts/nomination-evaluation-" + PROMPT_VERSION + ".txt")
                    .getInputStream().readAllBytes();
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Missing prompt file for version " + PROMPT_VERSION, e);
        }
    }

    /** Minimal request shape (OpenAI-compatible) - just what this call needs, not a full SDK. */
    private static class GroqRequest {
        public final String model;
        public final int max_tokens = 300;
        public final List<Message> messages;

        GroqRequest(String model, String prompt) {
            this.model = model;
            this.messages = List.of(new Message("user", prompt));
        }

        static class Message {
            public final String role;
            public final String content;

            Message(String role, String content) {
                this.role = role;
                this.content = content;
            }
        }
    }
}
