package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.AiFlag;
import com.version1.recognition.nomination.model.FlagSource;
import com.version1.recognition.nomination.model.NominationFlag;


/**
 * One flag as the dashboard sees it. Kept separate from the persisted
 * {@link NominationFlag} so the stored shape and the wire shape can move
 * independently, and adds {@code label} - the flag name written for a human -
 * so every client isn't left to invent its own enum-to-English mapping.
 */
public class NominationFlagResponse {

    private final AiFlag flag;
    private final String label;
    private final FlagSource source;
    private final String reason;

    public NominationFlagResponse(NominationFlag flag) {
        this.flag = flag.getFlag();
        this.label = toLabel(flag.getFlag());
        this.source = flag.getSource();
        this.reason = flag.getReason();
    }

    private static String toLabel(AiFlag flag) {
        if (flag == null) {
            return "Unknown";
        }
        String words = flag.name().toLowerCase().replace('_', ' ');
        return Character.toUpperCase(words.charAt(0)) + words.substring(1);
    }

    public AiFlag getFlag() {
        return flag;
    }

    public String getLabel() {
        return label;
    }

    public FlagSource getSource() {
        return source;
    }

    public String getReason() {
        return reason;
    }
}
