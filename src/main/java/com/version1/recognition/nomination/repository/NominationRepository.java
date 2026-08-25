package com.version1.recognition.nomination.repository;

import com.version1.recognition.nomination.model.Nomination;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Nomination storage.
 *
 * <p>Bare on purpose. The rules that compare nominations against each other
 * (reciprocal, repeat-quarter, one-per-quarter) all need the whole set, so they
 * take it as a parameter instead of each running its own query - which also
 * makes them testable without a database.
 *
 * <p>The cost is that those paths load every row. Fine now; see the note on
 * TaggingService.retagAll for why it won't be at volume.
 */
public interface NominationRepository extends JpaRepository<Nomination, UUID> {
}
