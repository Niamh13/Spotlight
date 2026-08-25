package com.version1.recognition.common;

import com.version1.recognition.nomination.exception.InvalidReviewStateException;
import com.version1.recognition.nomination.exception.QuarterLimitReachedException;
import com.version1.recognition.nomination.exception.SelfNominationException;
import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(SelfNominationException.class)
    public ResponseEntity<Map<String, String>> handleSelfNomination(SelfNominationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
    }

    // 409 rather than 400: the submission is well-formed, it just conflicts with
    // the one this person already made this quarter.
    @ExceptionHandler(QuarterLimitReachedException.class)
    public ResponseEntity<Map<String, String>> handleQuarterLimit(QuarterLimitReachedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", ex.getMessage(),
                "reason", "QUARTER_LIMIT",
                "quarter", ex.getQuarterLabel()));
    }

    @ExceptionHandler(InvalidReviewStateException.class)
    public ResponseEntity<Map<String, String>> handleInvalidReviewState(InvalidReviewStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(err -> errors.put(err.getField(), err.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }
}
