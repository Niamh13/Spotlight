package com.version1.recognition.nomination;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, UUID> {
    List<AuditLogEntry> findByNominationIdOrderByOccurredAtAsc(UUID nominationId);
}
