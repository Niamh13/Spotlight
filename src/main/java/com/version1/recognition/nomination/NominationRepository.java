package com.version1.recognition.nomination;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NominationRepository extends JpaRepository<Nomination, UUID> {

    List<Nomination> findByNomineeEmailAndSubmittedAtBetween(String nomineeEmail, Instant start, Instant endExclusive);

    boolean existsByNominatorEmailAndNomineeEmail(String nominatorEmail, String nomineeEmail);
}
