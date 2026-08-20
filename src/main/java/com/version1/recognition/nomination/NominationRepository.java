package com.version1.recognition.nomination;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface NominationRepository extends JpaRepository<Nomination, UUID> {
}
