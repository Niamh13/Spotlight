package com.version1.recognition.nomination;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.version1.recognition.nomination.comms.NotificationService;
import com.version1.recognition.nomination.evaluation.NominationEvaluator;
import com.version1.recognition.nomination.web.NominationRequest;

@ExtendWith(MockitoExtension.class)
class NominationServiceTest {

    @Mock
    private NominationRepository repository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TaggingService taggingService;

    @Mock
    private NominationEvaluator evaluator;

    @InjectMocks
    private NominationService service;

    @Test
    void submitAllowsSingleResubmissionForCurrentQuarter() {
        UUID originalId = UUID.randomUUID();
        Nomination original = new Nomination(
                "Calvin Ho",
                "calvin.ho@version1.com",
                "Alex Rivera",
                "alex.rivera@version1.com",
                "Cloud Engineering",
                "Dublin",
                AwardCategory.CUSTOMER_IMPACT,
                CoreValue.CUSTOMER_FIRST,
                "Delivered the migration",
                "Helped the client through a tight release",
                null);
        ReflectionTestUtils.setField(original, "id", originalId);
        original.setStatus(NominationStatus.NEEDS_RESUBMISSION);
        ReflectionTestUtils.setField(original, "submittedAt", Instant.now());

        when(repository.findAll()).thenReturn(List.of(original));
        when(taggingService.tag(any(), anyList())).thenReturn(Collections.emptyList());
        when(evaluator.isAvailable()).thenReturn(false);
        when(repository.save(any(Nomination.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NominationRequest request = new NominationRequest();
        request.setNominatorName("Calvin Ho");
        request.setNominatorEmail("calvin.ho@version1.com");
        request.setNomineeName("Alex Rivera");
        request.setNomineeEmail("alex.rivera@version1.com");
        request.setPractice("Cloud Engineering");
        request.setLocation("Dublin");
        request.setCategory(AwardCategory.CUSTOMER_IMPACT);
        request.setWhatText("Delivered the migration");
        request.setHowText("Helped the client through a tight release");
        request.setOriginalNominationId(originalId);

        assertDoesNotThrow(() -> service.submit(request));
    }

    @Test
    void submitRejectsSecondResubmissionForSameOriginalNomination() {
        UUID originalId = UUID.randomUUID();
        Nomination original = new Nomination(
                "Calvin Ho",
                "calvin.ho@version1.com",
                "Alex Rivera",
                "alex.rivera@version1.com",
                "Cloud Engineering",
                "Dublin",
                AwardCategory.CUSTOMER_IMPACT,
                CoreValue.CUSTOMER_FIRST,
                "Delivered the migration",
                "Helped the client through a tight release",
                null);
        ReflectionTestUtils.setField(original, "id", originalId);
        original.setStatus(NominationStatus.NEEDS_RESUBMISSION);
        ReflectionTestUtils.setField(original, "submittedAt", Instant.now());

        Nomination existingResubmission = new Nomination(
                "Calvin Ho",
                "calvin.ho@version1.com",
                "Alex Rivera",
                "alex.rivera@version1.com",
                "Cloud Engineering",
                "Dublin",
                AwardCategory.CUSTOMER_IMPACT,
                CoreValue.CUSTOMER_FIRST,
                "Delivered the migration with more detail",
                "Improved the client comms and support in the release",
                originalId);
        ReflectionTestUtils.setField(existingResubmission, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(existingResubmission, "submittedAt", Instant.now());
        existingResubmission.setStatus(NominationStatus.PENDING_REVIEW);

        when(repository.findAll()).thenReturn(List.of(original, existingResubmission));

        NominationRequest request = new NominationRequest();
        request.setNominatorName("Calvin Ho");
        request.setNominatorEmail("calvin.ho@version1.com");
        request.setNomineeName("Alex Rivera");
        request.setNomineeEmail("alex.rivera@version1.com");
        request.setPractice("Cloud Engineering");
        request.setLocation("Dublin");
        request.setCategory(AwardCategory.CUSTOMER_IMPACT);
        request.setWhatText("Delivered the migration with final detail");
        request.setHowText("Improved the client comms and support in the release");
        request.setOriginalNominationId(originalId);

        assertThrows(QuarterLimitReachedException.class, () -> service.submit(request));
    }
}
