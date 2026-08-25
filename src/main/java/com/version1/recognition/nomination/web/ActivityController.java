package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.AuditLogEntry;
import com.version1.recognition.nomination.model.Nomination;
import com.version1.recognition.nomination.repository.AuditLogRepository;
import com.version1.recognition.nomination.repository.NominationRepository;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Every recorded action, across every nomination, newest first.
 * <p>
 * The per-nomination history already existed, but answering "what did the team
 * do last week?" meant opening records one at a time and holding the answer in
 * your head. This is the same data read the other way round - by time rather
 * than by nomination - which is the view you want when reviewing how decisions
 * are being made rather than checking one of them.
 * <p>
 * Each entry carries the nomination's names so the log reads on its own, without
 * a lookup per row.
 */
@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    private final AuditLogRepository auditLogRepository;
    private final NominationRepository nominationRepository;

    public ActivityController(AuditLogRepository auditLogRepository,
                               NominationRepository nominationRepository) {
        this.auditLogRepository = auditLogRepository;
        this.nominationRepository = nominationRepository;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> all() {
        Map<UUID, Nomination> byId = nominationRepository.findAll().stream()
                .collect(Collectors.toMap(Nomination::getId, n -> n, (a, b) -> a));

        List<Map<String, Object>> out = auditLogRepository.findAll().stream()
                .sorted(Comparator.comparing(AuditLogEntry::getOccurredAt).reversed())
                .map(e -> {
                    Nomination n = byId.get(e.getNominationId());

                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", e.getId().toString());
                    row.put("nominationId", e.getNominationId().toString());
                    row.put("action", e.getAction().name());
                    row.put("coordinatorEmail", e.getCoordinatorEmail());
                    row.put("occurredAt", e.getOccurredAt().toString());
                    row.put("reason", e.getReason());
                    row.put("comment", e.getComment());
                    row.put("comms", e.getComms().stream().map(c -> {
                        Map<String, String> m = new LinkedHashMap<>();
                        m.put("recipientEmail", c.getRecipientEmail());
                        m.put("recipientRole", c.getRecipientRole().name());
                        m.put("subject", c.getSubject());
                        m.put("body", c.getBody());
                        m.put("sentAt", c.getSentAt() == null ? null : c.getSentAt().toString());
                        return m;
                    }).collect(Collectors.toList()));

                    // Null when a nomination has been deleted out from under its
                    // history - shouldn't happen, but the log shouldn't 500 if it does.
                    row.put("nomineeName", n == null ? "(deleted nomination)" : n.getNomineeName());
                    row.put("nominatorName", n == null ? null : n.getNominatorName());
                    row.put("categoryLabel", n == null || n.getCategory() == null
                            ? null : n.getCategory().getLabel());
                    return row;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(out);
    }
}
