package com.version1.recognition.nomination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Sends outcome comms to nominators and nominees (Epic 5). This is a stub -
 * there's no mail server wired up yet, so "sending" means logging the
 * message that would go out. Every method still marks commsSentDate on the
 * nomination, so the dashboard and audit trail behave exactly as they will
 * once a real mail sender is dropped in here.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    public void sendApprovalComms(Nomination nomination) {
        log.info("[COMMS] To nominee {}: your nomination was approved. Nomination: \"{}\"",
                nomination.getNomineeEmail(), nomination.getWhatText());
        log.info("[COMMS] To nominator {}: your nomination for {} was approved.",
                nomination.getNominatorEmail(), nomination.getNomineeName());
    }

    // Backs the "Send automated decline acknowledgement with reason" story.
    public void sendDeclineComms(Nomination nomination) {
        log.info("[COMMS] To nominator {}: your nomination for {} was declined. Reason: \"{}\"",
                nomination.getNominatorEmail(), nomination.getNomineeName(), nomination.getRejectionReason());
    }

    public void sendResubmissionRequestedComms(Nomination nomination) {
        log.info("[COMMS] To nominator {}: your nomination for {} needs changes before it can be approved. Feedback: \"{}\"",
                nomination.getNominatorEmail(), nomination.getNomineeName(), nomination.getRejectionReason());
    }
}
