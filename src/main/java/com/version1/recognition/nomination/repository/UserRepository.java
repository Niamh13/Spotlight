package com.version1.recognition.nomination.repository;

import com.version1.recognition.nomination.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Case-insensitive email lookup, done in SQL rather than in-Java like
     * NominationService's own equalsIgnoreCase() comparisons elsewhere -
     * this is the one place identity is resolved via a real query instead
     * of a full-table scan-and-compare.
     */
    Optional<User> findByEmailIgnoreCase(String email);
}
