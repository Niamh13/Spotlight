package com.version1.recognition.nomination.model;

/**
 * Advisory flags attached to a nomination by the rules or the AI. Shown to the
 * coordinator; they never block a submission or decide an outcome.
 */
public enum AiFlag {
    NOMINEE_NOT_ACTIVE_EMPLOYEE,
    ROUTINE_TASK_LANGUAGE,
    WEAK_JUSTIFICATION,
    REPEAT_NOMINATION_CONSECUTIVE_QUARTER,
    RECIPROCAL_NOMINATION,

    /**
     * Nominator and nominee are the same person. Submission already rejects an
     * exact email match, so this flag means they matched some other way - same
     * name on a different address, usually.
     */
    SELF_NOMINATION
}
