package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.AwardCategory;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves the five award categories to the front end.
 * <p>
 * The form could hardcode these, but then the labels and examples would exist in
 * two places and drift the first time someone reworded one. Served from the enum
 * instead, so the dropdown, the filters and any export are always describing the
 * same five things.
 */
@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    @GetMapping
    public ResponseEntity<List<Map<String, String>>> list() {
        List<Map<String, String>> categories = Arrays.stream(AwardCategory.values())
                .map(c -> Map.of(
                        "value", c.name(),
                        "label", c.getLabel(),
                        "examples", c.getExamples()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(categories);
    }
}
