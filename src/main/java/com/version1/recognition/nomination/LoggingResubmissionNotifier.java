package com.version1.recognition.nomination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Stub delivery: writes the message to the log instead of sending it.
 * <p>
 * Swap for a mail-backed implementation in Epic 5. Nothing else needs to
 * change - the request row and the {@code commsSentDate} stamp are written by
 * {@link ResubmissionService} either way, so "was a request sent" stays
 * answerable from the database rather than from the log.
 */
@Component
public class LoggingResubmissionNotifier implements ResubmissionNotifier {

    private static final Logger log = LoggerFactory.getLogger(LoggingResubmissionNotifier.class);

    @Override
    public void send(Nomination nomination, String recipientEmail, String message) {
        log.info("Would send resubmission request for nomination {} to {}:\n{}",
                nomination.getId(), recipientEmail, message);
    }
}
