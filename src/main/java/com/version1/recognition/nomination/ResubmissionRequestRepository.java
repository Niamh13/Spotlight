package com.version1.recognition.nomination;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ResubmissionRequestRepository extends JpaRepository<ResubmissionRequest, UUID> {

    List<ResubmissionRequest> findByNominationIdOrderBySentAtDesc(UUID nominationId);
}
