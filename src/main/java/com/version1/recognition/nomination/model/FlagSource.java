package com.version1.recognition.nomination.model;

/**
 * Where a flag came from.
 *
 * <p>This matters on retag: rule flags can be recalculated from the current
 * data, AI flags can't. So a retag replaces the RULE ones and leaves the AI
 * ones alone. Without the distinction, retagging would quietly delete work the
 * model did.
 */
public enum FlagSource {

    /** Raised by one of the NominationCheck rules. */
    RULE,

    /** Raised by the Groq evaluator. */
    AI
}
