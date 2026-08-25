package com.version1.recognition.nomination.comms;

import com.version1.recognition.nomination.model.Nomination;
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
        body.append("Thank you for your Star Award nomination for ");
        body.append(nomination.getNomineeName()).append(".\n\n");
        body.append("We’re happy to confirm it has been successfully submitted.\n\n");
        body.append("We really appreciate you taking the time to recognise great work "
                + "and celebrate the contributions of your colleagues.\n\n");
        body.append("If you’d like to recognise another colleague or team this quarter, "
                + "we encourage you to use Praise for everyday recognition and quick shout-outs.\n\n");
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

        body.append("Best regards,\nThe Star Awards Team\n\n");
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
        String subject = "Congratulations on your Star Award Nomination!";

        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(nomination.getNomineeName()).append(",\n\n");
        body.append(nomination.getNominatorName()).append(" recognised you:\n\n");
        body.append("  WHAT THEY RECOGNISED\n  ").append(nomination.getWhatText()).append("\n\n");
        body.append("  HOW IT DEMONSTRATED OUR VALUES\n  ").append(nomination.getHowText()).append("\n\n");

        if (nomination.getCategory() != null) {
            body.append("Category: ").append(nomination.getCategory().getLabel()).append("\n\n");
        }

        body.append("Best regards,\nThe Star Awards Team\n\n");
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
        body.append(
                "Thank you for taking the time to submit a Star Award nomination. We really appreciate your effort in recognising great work.\n\n");
        body.append("Unfortunately, this nomination was not successful on this occasion.\n\n");
        body.append("Reason for this decision:\n").append(nomination.getRejectionReason()).append("\n\n");

        if (coordinatorComment != null && !coordinatorComment.isBlank()) {
            body.append("Additional note:\n").append(coordinatorComment).append("\n\n");
        }

        body.append(
                "If you’d still like to recognise this colleague or another team member, we encourage you to use Praise, which is designed for everyday recognition and quick shout-outs.\n\n");
        body.append("Thank you again for helping us celebrate great contributions across the business.\n\n");
        body.append("Best regards,\nThe Star Awards Team\n\n");

        body.append("Reference: ").append(nomination.getId()).append("\n");

        return record(nomination.getNominatorEmail(), subject, body.toString());
    }

    /** Asks the nominator for more detail, quoting what they originally wrote. */
    public SentEmail sendResubmissionRequestedComms(Nomination nomination, String coordinatorComment) {
        String subject = "Your Star Award nomination for "
                + nomination.getNomineeName() + " is pending";

        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(nomination.getNominatorName()).append(",\n\n");
        body.append(
                "Thank you for submitting a Star Award nomination and for taking the time to recognise a colleague’s contribution.\n\n");
        body.append(
                "Your nomination is currently pending, as we need a bit more information before it can be fully assessed.\n\n");

        body.append("Please provide:\n").append(nomination.getRejectionReason()).append("\n\n");

        if (coordinatorComment != null && !coordinatorComment.isBlank()) {
            body.append("Additional note:\n").append(coordinatorComment).append("\n\n");
        }

        body.append("Once updated, we’ll be happy to review the nomination again.\n\n");
        body.append(
                "In the meantime, if you’d like to recognise everyday contributions from colleagues or teams, we encourage you to use Praise for quick and visible recognition.\n\n");

        body.append("Your original wording is below, so you can build on it rather than start again.\n\n");
        body.append("  WHAT: ").append(nomination.getWhatText()).append("\n");
        body.append("  HOW:  ").append(nomination.getHowText()).append("\n\n");
        body.append("Thanks again for your engagement and support.\n\n");
        body.append("Best regards,\nThe Star Awards Team\n\n");
        body.append("Reference: ").append(nomination.getId()).append("\n");

        return record(nomination.getNominatorEmail(), subject, body.toString());
    }

    private SentEmail record(String recipient, String subject, String body) {
        log.info("[COMMS - composed, not delivered: no mail server] to={} subject=\"{}\"",
                recipient, subject);
        return new SentEmail(recipient, subject, body);
    }
}
