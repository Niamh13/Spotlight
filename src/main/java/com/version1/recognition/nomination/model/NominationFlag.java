package com.version1.recognition.nomination.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One flag raised against a nomination, with the reason it was raised.
 * <p>
 * The reason is the point. A bare {@code WEAK_JUSTIFICATION} tells a coordinator
 * that something tripped, but not what, so they have to re-derive the judgement
 * themselves - at which point the flag has saved them nothing. Carrying the
 * reason ("under 150 characters, no figures given") turns the flag into
 * something they can act on or dismiss in one read.
 */
@Embeddable
public class NominationFlag {

    @Enumerated(EnumType.STRING)
    @Column(name = "flag", nullable = false, length = 100)
    private AiFlag flag;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    private FlagSource source;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "reason")
    private String reason;

    protected NominationFlag() {
        // required by JPA
    }

    public NominationFlag(AiFlag flag, FlagSource source, String reason) {
        this.flag = flag;
        this.source = source;
        this.reason = reason;
    }

    public AiFlag getFlag() {
        return flag;
    }

    public FlagSource getSource() {
        return source;
    }

    public String getReason() {
        return reason;
    }

    // Value semantics: this is an @Embeddable in an element collection, and
    // Hibernate compares instances when working out what changed on a retag.
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof NominationFlag)) return false;
        NominationFlag other = (NominationFlag) o;
        return flag == other.flag
                && source == other.source
                && Objects.equals(reason, other.reason);
    }

    @Override
    public int hashCode() {
        return Objects.hash(flag, source, reason);
    }

    @Override
    public String toString() {
        return flag + " (" + source + ")";
    }
}
