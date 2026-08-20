package com.version1.recognition.nomination;

/**
 * Advisory flags the AI tagging step (Epic 2) can attach to a nomination.
 * These are shown to the coordinator alongside the nomination - they never
 * block submission and never decide approve/reject on their own.
 */
public enum AiFlag {
    NOMINEE_NOT_ACTIVE_EMPLOYEE,
    ROUTINE_TASK_LANGUAGE,
    WEAK_JUSTIFICATION,
    REPEAT_NOMINATION_CONSECUTIVE_QUARTER,
    RECIPROCAL_NOMINATION,

    /**
     * Nominator and nominee are the same person. Submission already blocks this
     * on an exact email match, so a flag here means the pair matched some other
     * way - same name, different address - or the row predates that check.
     */
    SELF_NOMINATION
}
