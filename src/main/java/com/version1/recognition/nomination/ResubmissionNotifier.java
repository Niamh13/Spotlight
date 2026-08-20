package com.version1.recognition.nomination;

/**
 * Delivers a resubmission request to the nominator.
 * <p>
 * Split out as an interface so Epic 5 (Comms) can drop in a real mail sender
 * without touching the evaluation or the request record. Same approach the
 * README sets out for the Reachdesk trigger: stub it, log it, swap it later.
 */
public interface ResubmissionNotifier {

    /**
     * @throws NotificationFailedException if the message could not be delivered,
     *         in which case no request record is written and the nomination's
     *         status is left alone.
     */
    void send(Nomination nomination, String recipientEmail, String message);

    class NotificationFailedException extends RuntimeException {
        public NotificationFailedException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
