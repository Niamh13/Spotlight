package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.model.NominationStatus;
import com.version1.recognition.nomination.model.Quarter;
import com.version1.recognition.nomination.repository.NominationRepository;
import com.version1.recognition.nomination.service.NominationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quarter-level views: what quarter it is, whether you've used your nomination,
 * and - for coordinators - who has taken part in each quarter on record.
 */
@RestController
@RequestMapping("/api/quarters")
public class QuarterController {

    private final NominationService service;
    private final NominationRepository repository;

    public QuarterController(NominationService service, NominationRepository repository) {
        this.service = service;
        this.repository = repository;
    }

    /**
     * The current quarter, and this person's standing in it.
     * <p>
     * The email is a query parameter because there is still no authentication:
     * the caller says who they are. That makes this a convenience for the form,
     * not a security boundary - the same caveat that applies to the profile
     * switcher, and the reason the submit endpoint re-checks the limit itself
     * rather than trusting what this returned.
     */
    @GetMapping("/current")
    public ResponseEntity<Map<String, Object>> current(
            @RequestParam(required = false) String email) {

        Quarter q = Quarter.current();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", q.code());
        body.put("label", q.label());
        body.put("startsAt", q.start().toString());
        body.put("endsAt", q.endExclusive().toString());
        body.put("deadline", q.submissionDeadline().toString());
        body.put("daysUntilDeadline", q.daysUntilDeadline());
        body.put("nextQuarterLabel", q.next().label());

        if (email != null && !email.isBlank()) {
            Nomination mine = service.findCurrentQuarterNomination(email);
            body.put("hasSubmitted", mine != null);
            if (mine != null) {
                Map<String, Object> submitted = new LinkedHashMap<>();
                submitted.put("id", mine.getId().toString());
                submitted.put("nomineeName", mine.getNomineeName());
                submitted.put("status", mine.getStatus().name());
                submitted.put("submittedAt", mine.getSubmittedAt().toString());
                submitted.put("categoryLabel",
                        mine.getCategory() == null ? null : mine.getCategory().getLabel());
                body.put("submission", submitted);
            }
        } else {
            body.put("hasSubmitted", false);
        }

        return ResponseEntity.ok(body);
    }

    /**
     * Every quarter that has nominations, newest first, with who took part.
     * <p>
     * Derived from the nominations themselves rather than a quarters table -
     * there is nothing to store that the submission dates don't already say, and
     * a separate table would be one more thing that could disagree with them.
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> history() {
        List<Nomination> all = repository.findAll();

        // Every quarter present in the data, plus the current one so it appears
        // even before anybody has nominated in it.
        TreeSet<Quarter> quarters = new TreeSet<>(Comparator.reverseOrder());
        quarters.add(Quarter.current());
        all.stream()
                .map(Nomination::getSubmittedAt)
                .filter(java.util.Objects::nonNull)
                .map(Quarter::of)
                .forEach(quarters::add);

        List<Map<String, Object>> out = new ArrayList<>();
        for (Quarter q : quarters) {
            List<Nomination> inQuarter = all.stream()
                    .filter(n -> q.contains(n.getSubmittedAt()))
                    .toList();

            // One row per nominator: who they put forward and how it went.
            Map<String, Map<String, Object>> byNominator = new LinkedHashMap<>();
            for (Nomination n : inQuarter) {
                String key = n.getNominatorEmail() == null
                        ? "" : n.getNominatorEmail().toLowerCase();
                Map<String, Object> entry = byNominator.computeIfAbsent(key, k -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("nominatorName", n.getNominatorName());
                    m.put("nominatorEmail", n.getNominatorEmail());
                    m.put("nominations", new ArrayList<Map<String, Object>>());
                    return m;
                });
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> list = (List<Map<String, Object>>) entry.get("nominations");
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", n.getId().toString());
                item.put("nomineeName", n.getNomineeName());
                item.put("status", n.getStatus().name());
                item.put("categoryLabel",
                        n.getCategory() == null ? null : n.getCategory().getLabel());
                item.put("isResubmission", n.getOriginalNominationId() != null);
                list.add(item);
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", q.code());
            row.put("label", q.label());
            row.put("isCurrent", q.equals(Quarter.current()));
            row.put("deadline", q.submissionDeadline().toString());
            row.put("totalNominations", inQuarter.size());
            row.put("participants", byNominator.size());
            row.put("approved", inQuarter.stream()
                    .filter(n -> n.getStatus() == NominationStatus.APPROVED).count());
            row.put("pending", inQuarter.stream()
                    .filter(n -> n.getStatus() == NominationStatus.PENDING_REVIEW).count());
            row.put("nominators", new ArrayList<>(byNominator.values()));
            out.add(row);
        }

        return ResponseEntity.ok(out);
    }

    /** Guard against a clock-skewed client disagreeing about "now". */
    @GetMapping("/now")
    public ResponseEntity<Map<String, String>> now() {
        return ResponseEntity.ok(Map.of("serverTime", Instant.now().toString()));
    }
}
