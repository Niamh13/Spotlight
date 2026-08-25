package com.version1.recognition.nomination.repository;

import com.version1.recognition.nomination.model.AuditLogEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, UUID> {
    List<AuditLogEntry> findByNominationIdOrderByOccurredAtAsc(UUID nominationId);
}
