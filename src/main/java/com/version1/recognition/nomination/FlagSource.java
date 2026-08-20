package com.version1.recognition.nomination;

/**
 * Where a flag came from. This matters because the two sources have different
 * lifetimes: rule flags are recomputed from the current data every time
 * {@link TaggingService} runs, while AI flags are a record of what a model said
 * at one moment and can't be reproduced by re-running anything.
 * <p>
 * Retagging therefore replaces {@link #RULE} flags and leaves {@link #AI} ones
 * alone - without this distinction a retag would silently delete the AI's work.
 */
public enum FlagSource {

    /** Produced by a {@link com.version1.recognition.nomination.check.NominationCheck}. */
    RULE,

    /** Produced by the Groq evaluator. */
    AI
}
