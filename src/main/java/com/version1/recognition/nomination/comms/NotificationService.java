package com.version1.recognition.nomination.comms;

import com.version1.recognition.nomination.Nomination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Writes the messages a coordinator decision produces.
 *
 * <p><b>Nothing is delivered.</b> There is no mail server configured, so
 * "sending" here means composing the message, logging that it happened, and
 * handing it back so it can be stored against the audit entry. Every screen that
 * displays one of these says so, rather than implying it reached an inbox.
 *
 * <p>Each method returns the composed {@link SentEmail} rather than void, so the
 * caller can keep a copy of exactly what was produced. Wiring in a real mail
 * sender later means changing this class only - the callers stay as they are.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    /** Confirms to the nominator that their nomination was approved. */
    public SentEmail sendApprovalComms(Nomination nomination, String coordinatorComment) {
        String subject = "Your Star Award nomination for " + nomination.getNomineeName()
                + " has been approved";

        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(nomination.getNominatorName()).append(",\n\n");
        body.append("Good news - the Star Award nomination you submitted for ");
        body.append(nomination.getNomineeName()).append(" has been approved.\n\n");
        body.append("What you told us:\n");
        body.append("  WHAT: ").append(nomination.getWhatText()).append("\n");
        body.append("  HOW:  ").append(nomination.getHowText()).append("\n\n");

        if (nomination.getCategory() != null) {
            body.append("Category: ").append(nomination.getCategory().getLabel()).append("\n\n");
        }
        if (coordinatorComment != null && !coordinatorComment.isBlank()) {
            body.append("A note from the recognition team:\n");
            body.append(coordinatorComment).append("\n\n");
        }

        body.append("Thanks for taking the time to recognise a colleague.\n\n");
        body.append("Reference: ").append(nomination.getId()).append("\n");

        return record(nomination.getNominatorEmail(), subject, body.toString());
    }

    /**
     * Tells the nominee they have received a Star Award, quoting the nomination
     * in full.
     *
     * <p>Including the nomination text is a requirement, and the right one:
     * being told you won without being told what for is a strange thing to
     * receive, and the words a colleague chose about you are most of the value.
     */
    public SentEmail sendNomineeAwardComms(Nomination nomination) {
        String subject = "You have received a Star Award";

        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(nomination.getNomineeName()).append(",\n\n");
        body.append("You have been recognised with a Star Award, nominated by ");
        body.append(nomination.getNominatorName()).append(".\n\n");
        body.append("Here is what they said:\n\n");
        body.append("  WHAT THEY RECOGNISED\n  ").append(nomination.getWhatText()).append("\n\n");
        body.append("  HOW IT DEMONSTRATED OUR VALUES\n  ").append(nomination.getHowText()).append("\n\n");

        if (nomination.getCategory() != null) {
            body.append("Category: ").append(nomination.getCategory().getLabel()).append("\n\n");
        }

        body.append("Congratulations - this was genuinely earned.\n\n");
        body.append("Reference: ").append(nomination.getId()).append("\n");

        return record(nomination.getNomineeEmail(), subject, body.toString());
    }

    /**
     * Tells the nominator their nomination was not taken forward, and why.
     * The nominee is deliberately not told - nobody benefits from hearing that
     * a nomination about them was turned down.
     */
    public SentEmail sendDeclineComms(Nomination nomination, String coordinatorComment) {
        String subject = "Your Star Award nomination for " + nomination.getNomineeName();

        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(nomination.getNominatorName()).append(",\n\n");
        body.append("Thank you for nominating ").append(nomination.getNomineeName());
        body.append(" for a Star Award. On this occasion it has not been taken forward.\n\n");
        body.append("Why:\n").append(nomination.getRejectionReason()).append("\n\n");

        if (coordinatorComment != null && !coordinatorComment.isBlank()) {
            body.append("Additional note:\n").append(coordinatorComment).append("\n\n");
        }

        body.append("This reflects the nomination rather than your colleague's work, and it ");
        body.append("does not stop them being nominated again in a future quarter.\n\n");
        body.append("Reference: ").append(nomination.getId()).append("\n");

        return record(nomination.getNominatorEmail(), subject, body.toString());
    }

    /** Asks the nominator for more detail, quoting what they originally wrote. */
    public SentEmail sendResubmissionRequestedComms(Nomination nomination, String coordinatorComment) {
        String subject = "More detail needed on your Star Award nomination for "
                + nomination.getNomineeName();

        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(nomination.getNominatorName()).append(",\n\n");
        body.append("Thanks for nominating ").append(nomination.getNomineeName());
        body.append(" for a Star Award. Before it can go to review we need a little more detail.\n\n");
        body.append("What to add:\n").append(nomination.getRejectionReason()).append("\n\n");

        if (coordinatorComment != null && !coordinatorComment.isBlank()) {
            body.append("Additional note:\n").append(coordinatorComment).append("\n\n");
        }

        body.append("Your original wording is below, so you can build on it rather than start again.\n\n");
        body.append("  WHAT: ").append(nomination.getWhatText()).append("\n");
        body.append("  HOW:  ").append(nomination.getHowText()).append("\n\n");
        body.append("Resubmitting does not use up another nomination - it continues the entry ");
        body.append("you already made this quarter.\n\n");
        body.append("Reference: ").append(nomination.getId()).append("\n");

        return record(nomination.getNominatorEmail(), subject, body.toString());
    }

    private SentEmail record(String recipient, String subject, String body) {
        log.info("[COMMS - composed, not delivered: no mail server] to={} subject=\"{}\"",
                recipient, subject);
        return new SentEmail(recipient, subject, body);
    }
}
