package com.version1.recognition.nomination.model;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

/**
 * A calendar quarter, in UTC.
 * <p>
 * Pulled into its own type because five separate features now depend on getting
 * the same answer to "which quarter is this?": the one-nomination-per-quarter
 * limit, the submission deadline countdown, the repeat-nomination check, the
 * per-quarter admin view, and the new-quarter reset. Left as scattered date
 * arithmetic they would drift, and the roll-back-across-a-year-boundary case is
 * the one that would quietly break first.
 * <p>
 * UTC throughout. A quarter boundary that moves with the reader's timezone would
 * mean two people in different offices disagreeing about whether a nomination
 * submitted late on 31 March counted for Q1 or Q2.
 */
public final class Quarter implements Comparable<Quarter> {

    private final int year;
    private final int index;   // 0-3

    private Quarter(int year, int index) {
        this.year = year;
        this.index = index;
    }

    public static Quarter of(Instant instant) {
        ZonedDateTime z = instant.atZone(ZoneOffset.UTC);
        return new Quarter(z.getYear(), (z.getMonthValue() - 1) / 3);
    }

    public static Quarter current() {
        return of(Instant.now());
    }

    /** Parses "2026-Q3". Returns null rather than throwing on rubbish input. */
    public static Quarter parse(String code) {
        if (code == null) {
            return null;
        }
        String[] parts = code.trim().toUpperCase().split("-Q");
        if (parts.length != 2) {
            return null;
        }
        try {
            int y = Integer.parseInt(parts[0]);
            int q = Integer.parseInt(parts[1]);
            if (q < 1 || q > 4) {
                return null;
            }
            return new Quarter(y, q - 1);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public Quarter previous() {
        return index == 0 ? new Quarter(year - 1, 3) : new Quarter(year, index - 1);
    }

    public Quarter next() {
        return index == 3 ? new Quarter(year + 1, 0) : new Quarter(year, index + 1);
    }

    public Instant start() {
        return ZonedDateTime.of(year, index * 3 + 1, 1, 0, 0, 0, 0, ZoneOffset.UTC).toInstant();
    }

    public Instant endExclusive() {
        return ZonedDateTime.of(year, index * 3 + 1, 1, 0, 0, 0, 0, ZoneOffset.UTC)
                .plusMonths(3).toInstant();
    }

    public boolean contains(Instant instant) {
        return instant != null && !instant.isBefore(start()) && instant.isBefore(endExclusive());
    }

    /**
     * The last Friday of the quarter - the cut-off nominations are judged
     * against, and what the countdown on the submission form ticks down to.
     * <p>
     * Walks back from the final day rather than forward from the last week,
     * which is the version that gets the answer wrong when a quarter happens to
     * end on a Saturday.
     */
    public LocalDate submissionDeadline() {
        LocalDate lastDay = LocalDate.ofInstant(endExclusive(), ZoneOffset.UTC).minusDays(1);
        int back = (lastDay.getDayOfWeek().getValue() - DayOfWeek.FRIDAY.getValue() + 7) % 7;
        return lastDay.minusDays(back);
    }

    /** Whole days from today until the deadline. Negative once it has passed. */
    public long daysUntilDeadline() {
        return ChronoUnit.DAYS.between(LocalDate.now(ZoneOffset.UTC), submissionDeadline());
    }

    public int getYear() {
        return year;
    }

    /** 1-4, for display. */
    public int getNumber() {
        return index + 1;
    }

    /** Sortable, machine-readable: "2026-Q3". */
    public String code() {
        return year + "-Q" + getNumber();
    }

    /** Human-readable: "Q3 2026". */
    public String label() {
        return "Q" + getNumber() + " " + year;
    }

    @Override
    public int compareTo(Quarter other) {
        return year != other.year
                ? Integer.compare(year, other.year)
                : Integer.compare(index, other.index);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Quarter)) return false;
        Quarter other = (Quarter) o;
        return year == other.year && index == other.index;
    }

    @Override
    public int hashCode() {
        return Objects.hash(year, index);
    }

    @Override
    public String toString() {
        return code();
    }
}
