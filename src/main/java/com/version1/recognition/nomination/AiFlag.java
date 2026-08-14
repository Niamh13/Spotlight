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
    RECIPROCAL_NOMINATION
}
