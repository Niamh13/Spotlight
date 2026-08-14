package com.version1.recognition.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import com.version1.recognition.nomination.ResubmissionNotApplicableException;
import com.version1.recognition.nomination.SelfNominationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;

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

    /**
     * A state conflict rather than a bad request - the nomination exists and the
     * body was fine, it just isn't in a state where a resubmission can be asked for.
     */
    @ExceptionHandler(ResubmissionNotApplicableException.class)
    public ResponseEntity<Map<String, String>> handleResubmissionNotApplicable(
            ResubmissionNotApplicableException ex) {
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
