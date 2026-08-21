package com.version1.recognition.nomination;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Month;

import static org.assertj.core.api.Assertions.assertThat;

class QuarterTest {

    @Nested
    @DisplayName("of() / current()")
    class Of {

        @Test
        @DisplayName("maps a January instant to Q1")
        void januaryIsQ1() {
            Quarter q = Quarter.of(Instant.parse("2026-01-15T00:00:00Z"));

            assertThat(q.getYear()).isEqualTo(2026);
            assertThat(q.getNumber()).isEqualTo(1);
        }

        @Test
        @DisplayName("maps a December instant to Q4")
        void decemberIsQ4() {
            Quarter q = Quarter.of(Instant.parse("2026-12-31T23:59:59Z"));

            assertThat(q.getNumber()).isEqualTo(4);
            assertThat(q.getYear()).isEqualTo(2026);
        }

        @ParameterizedTest(name = "{0} -> Q{1}")
        @CsvSource({
                "2026-01-01T00:00:00Z, 1",
                "2026-03-31T23:59:59Z, 1",
                "2026-04-01T00:00:00Z, 2",
                "2026-06-30T23:59:59Z, 2",
                "2026-07-01T00:00:00Z, 3",
                "2026-09-30T23:59:59Z, 3",
                "2026-10-01T00:00:00Z, 4",
                "2026-12-31T23:59:59Z, 4",
        })
        @DisplayName("every month lands in the correct quarter")
        void monthBoundaries(String instant, int expectedQuarter) {
            Quarter q = Quarter.of(Instant.parse(instant));

            assertThat(q.getNumber()).isEqualTo(expectedQuarter);
        }
    }

    @Nested
    @DisplayName("previous() / next()")
    class PreviousNext {

        @Test
        @DisplayName("previous() from Q1 rolls back to Q4 of the prior year")
        void previousAcrossYearBoundary() {
            Quarter q1 = Quarter.parse("2026-Q1");

            Quarter previous = q1.previous();

            assertThat(previous.getYear()).isEqualTo(2025);
            assertThat(previous.getNumber()).isEqualTo(4);
        }

        @Test
        @DisplayName("next() from Q4 rolls forward to Q1 of the next year")
        void nextAcrossYearBoundary() {
            Quarter q4 = Quarter.parse("2026-Q4");

            Quarter next = q4.next();

            assertThat(next.getYear()).isEqualTo(2027);
            assertThat(next.getNumber()).isEqualTo(1);
        }

        @Test
        @DisplayName("previous() within a year just decrements the index")
        void previousWithinYear() {
            Quarter q3 = Quarter.parse("2026-Q3");

            assertThat(q3.previous()).isEqualTo(Quarter.parse("2026-Q2"));
        }

        @Test
        @DisplayName("next() within a year just increments the index")
        void nextWithinYear() {
            Quarter q2 = Quarter.parse("2026-Q2");

            assertThat(q2.next()).isEqualTo(Quarter.parse("2026-Q3"));
        }
    }

    @Nested
    @DisplayName("contains()")
    class Contains {

        @Test
        @DisplayName("includes the exact start instant")
        void includesStartInstant() {
            Quarter q1 = Quarter.parse("2026-Q1");

            assertThat(q1.contains(q1.start())).isTrue();
        }

        @Test
        @DisplayName("excludes the exact endExclusive instant")
        void excludesEndInstant() {
            Quarter q1 = Quarter.parse("2026-Q1");

            assertThat(q1.contains(q1.endExclusive())).isFalse();
        }

        @Test
        @DisplayName("includes the instant one nanosecond before endExclusive")
        void includesLastInstantOfQuarter() {
            Quarter q1 = Quarter.parse("2026-Q1");

            assertThat(q1.contains(q1.endExclusive().minusNanos(1))).isTrue();
        }

        @Test
        @DisplayName("null instant is not contained")
        void nullIsNotContained() {
            Quarter q1 = Quarter.parse("2026-Q1");

            assertThat(q1.contains(null)).isFalse();
        }

        @Test
        @DisplayName("an instant from the next quarter is not contained")
        void excludesAdjacentQuarter() {
            Quarter q1 = Quarter.parse("2026-Q1");

            assertThat(q1.contains(Quarter.parse("2026-Q2").start())).isFalse();
        }
    }

    @Nested
    @DisplayName("submissionDeadline() - last Friday of the quarter")
    class SubmissionDeadline {

        // Walks backward from the final calendar day of each quarter to the
        // preceding (or same) Friday. Parameterized over consecutive quarters
        // so several different end-of-quarter weekdays get exercised without
        // hand-picking specific years - this is exactly the kind of arithmetic
        // the class javadoc warns a forward-from-last-week version gets wrong.
        @ParameterizedTest(name = "{0} deadline is a Friday on/before quarter end")
        @ValueSource(strings = {"2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1"})
        @DisplayName("deadline always falls on a Friday, on or before the quarter's last day")
        void deadlineIsAFridayOnOrBeforeQuarterEnd(String code) {
            Quarter q = Quarter.parse(code);
            LocalDate lastDay = LocalDate.ofInstant(q.endExclusive(), java.time.ZoneOffset.UTC).minusDays(1);

            LocalDate deadline = q.submissionDeadline();

            assertThat(deadline.getDayOfWeek()).isEqualTo(java.time.DayOfWeek.FRIDAY);
            assertThat(deadline).isBeforeOrEqualTo(lastDay);
            assertThat(deadline).isAfter(lastDay.minusDays(7));
        }

        @Test
        @DisplayName("Q1 2026 ends on a Tuesday (31 Mar) - deadline is the preceding Friday, 27 Mar")
        void knownCase_q1EndsOnTuesday() {
            Quarter q1 = Quarter.parse("2026-Q1");

            assertThat(LocalDate.of(2026, Month.MARCH, 31).getDayOfWeek())
                    .isEqualTo(java.time.DayOfWeek.TUESDAY);
            assertThat(q1.submissionDeadline()).isEqualTo(LocalDate.of(2026, Month.MARCH, 27));
        }
    }

    @Nested
    @DisplayName("parse()")
    class Parse {

        @Test
        @DisplayName("parses a well-formed code")
        void parsesWellFormed() {
            Quarter q = Quarter.parse("2026-Q3");

            assertThat(q.getYear()).isEqualTo(2026);
            assertThat(q.getNumber()).isEqualTo(3);
        }

        @Test
        @DisplayName("is case-insensitive and trims whitespace")
        void parsesLowercaseAndWhitespace() {
            Quarter q = Quarter.parse("  2026-q3  ");

            assertThat(q).isEqualTo(Quarter.parse("2026-Q3"));
        }

        @NullAndEmptySource
        @ParameterizedTest
        @DisplayName("null or empty input returns null rather than throwing")
        void nullOrEmptyReturnsNull(String input) {
            assertThat(Quarter.parse(input)).isNull();
        }

        @ParameterizedTest
        @ValueSource(strings = {"garbage", "2026", "Q3", "2026-Q0", "2026-Q5", "abcd-Qx", "2026-Q3-extra"})
        @DisplayName("malformed input returns null rather than throwing")
        void malformedReturnsNull(String input) {
            assertThat(Quarter.parse(input)).isNull();
        }
    }

    @Nested
    @DisplayName("code() / label() / equals() / compareTo()")
    class Formatting {

        @Test
        @DisplayName("code() is machine-readable and round-trips through parse()")
        void codeRoundTrips() {
            Quarter q = Quarter.parse("2026-Q3");

            assertThat(Quarter.parse(q.code())).isEqualTo(q);
        }

        @Test
        @DisplayName("label() is human-readable")
        void labelIsHumanReadable() {
            assertThat(Quarter.parse("2026-Q3").label()).isEqualTo("Q3 2026");
        }

        @Test
        @DisplayName("equal year and quarter are equal, regardless of instance")
        void equalityIsValueBased() {
            assertThat(Quarter.parse("2026-Q3")).isEqualTo(Quarter.parse("2026-Q3"));
            assertThat(Quarter.parse("2026-Q3").hashCode())
                    .isEqualTo(Quarter.parse("2026-Q3").hashCode());
        }

        @Test
        @DisplayName("compareTo() orders by year first, then quarter index")
        void compareToOrdersByYearThenQuarter() {
            assertThat(Quarter.parse("2025-Q4").compareTo(Quarter.parse("2026-Q1"))).isNegative();
            assertThat(Quarter.parse("2026-Q3").compareTo(Quarter.parse("2026-Q1"))).isPositive();
            assertThat(Quarter.parse("2026-Q3").compareTo(Quarter.parse("2026-Q3"))).isZero();
        }
    }
}
