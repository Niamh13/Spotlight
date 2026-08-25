package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.CoreValue;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves Version 1's six core values to the submission form.
 *
 * <p>Same reasoning as the categories endpoint: served from the enum rather than
 * hardcoded in the front end, so the picker, the guidance under it and anything
 * that reports on values are all describing the same six things.
 */
@RestController
@RequestMapping("/api/core-values")
public class CoreValueController {

    @GetMapping
    public ResponseEntity<List<Map<String, String>>> list() {
        List<Map<String, String>> values = Arrays.stream(CoreValue.values())
                .map(v -> Map.of(
                        "value", v.name(),
                        "label", v.getLabel(),
                        "prompt", v.getPrompt()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(values);
    }
}
