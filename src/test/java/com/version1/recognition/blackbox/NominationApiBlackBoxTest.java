package com.version1.recognition.blackbox;

import com.version1.recognition.nomination.model.Role;
import com.version1.recognition.nomination.model.User;
import com.version1.recognition.nomination.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Black-box tests against the public REST API only. No source-code knowledge
 * used or assumed beyond the documented request/response shapes: every
 * assertion here treats /api/nominations/* as a spec, not an implementation.
 * Runs a real Spring context on a random port, against an isolated MySQL
 * database (see application-blackbox.properties) with no demo seed data,
 * so scenarios build their own fixtures and don't depend on wall-clock-quarter
 * alignment with any seeded rows.
 *
 * Scenario ids (BB-1..BB-12) match the catalog in Spotlight_Test_Scenarios.docx.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("blackbox")
class NominationApiBlackBoxTest {

    private static final String API = "/api/nominations";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private UserRepository userRepository;

    // The blackbox profile's Spring context (and its in-memory DB) is cached
    // and reused across every test method in this class, so this has to be
    // idempotent - an unconditional save() would violate the unique email
    // constraint from the second test method onward.
    @BeforeEach
    void seedCoordinatorFixture() {
        if (userRepository.findByEmailIgnoreCase("coordinator@example.com").isEmpty()) {
            userRepository.save(new User("Coordinator", "coordinator@example.com", Role.COORDINATOR, null));
        }
    }

    /** Builds a valid nomination request body with unique emails per call, so
     * quarter-limit state from one test never leaks into another. */
    private Map<String, Object> validRequest(String nominatorEmail, String nomineeEmail) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("nominatorName", "Nominator");
        body.put("nominatorEmail", nominatorEmail);
        body.put("nomineeName", "Nominee");
        body.put("nomineeEmail", nomineeEmail);
        body.put("practice", "Cloud Engineering");
        body.put("location", "Dublin");
        body.put("category", "CUSTOMER_IMPACT");
        body.put("coreValue", "DRIVE");
        body.put("whatText", "They redesigned the deployment pipeline from scratch, cutting "
                + "release time from two days down to twenty minutes for the whole team.");
        body.put("howText", "They showed real drive, mapping every failure mode themselves "
                + "without being asked and fixing each one before it caused an incident.");
        return body;
    }

    private String uniqueEmail(String label) {
        return label + "-" + UUID.randomUUID() + "@example.com";
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> submit(Map<String, Object> body) {
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>)
                rest.postForEntity(API, body, Map.class);
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> get(String path) {
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>)
                rest.getForEntity(path, Map.class);
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> post(String path, Object body) {
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>)
                rest.postForEntity(path, body, Map.class);
    }

    @Nested
    @DisplayName("BB-1 / BB-2 / BB-7 - validation and self-nomination")
    class ValidationAndSelfNomination {

        @Test
        @DisplayName("BB-1: a required field missing returns 400 with a field-to-message map")
        void missingRequiredField_returns400WithFieldMap() {
            String nominator = uniqueEmail("nominator");
            Map<String, Object> body = validRequest(nominator, uniqueEmail("nominee"));
            body.put("nominatorName", ""); // blank -> fails @NotBlank

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("nominatorName");
        }

        @Test
        @DisplayName("BB-2: nominator and nominee sharing an email (any case) returns 400")
        void selfNomination_returns400() {
            String email = uniqueEmail("self");
            Map<String, Object> body = validRequest(email.toUpperCase(), email);

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("error");
        }

        @Test
        @DisplayName("BB-7: reject with no reason returns 400")
        void rejectWithNoReason_returns400() {
            Map<String, Object> submission = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            String id = (String) submit(submission).getBody().get("id");

            Map<String, Object> rejectBody = new LinkedHashMap<>();
            rejectBody.put("coordinatorEmail", "coordinator@example.com");
            // reason intentionally omitted - required by @NotBlank

            ResponseEntity<Map<String, Object>> response = post(API + "/" + id + "/reject", rejectBody);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("reason");
        }

        @Test
        @DisplayName("BB-23: approve with a coordinatorEmail unknown to the user directory returns 400, "
                + "not a silent success")
        void approveWithUnknownCoordinator_returns400() {
            Map<String, Object> submission = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            String id = (String) submit(submission).getBody().get("id");

            Map<String, Object> approveBody = new LinkedHashMap<>();
            approveBody.put("coordinatorEmail", uniqueEmail("not-a-coordinator"));

            ResponseEntity<Map<String, Object>> response = post(API + "/" + id + "/approve", approveBody);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("error");
        }
    }

    @Nested
    @DisplayName("BB-3 / BB-4 - quarter limit")
    class QuarterLimit {

        @Test
        @DisplayName("BB-3: a second submission from the same nominator this quarter returns 409 QUARTER_LIMIT")
        void secondSubmissionSameQuarter_returns409() {
            String nominator = uniqueEmail("nominator");
            submit(validRequest(nominator, uniqueEmail("first-nominee")));

            ResponseEntity<Map<String, Object>> second = submit(
                    validRequest(nominator, uniqueEmail("second-nominee")));

            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(second.getBody()).containsEntry("reason", "QUARTER_LIMIT");
            assertThat(second.getBody()).containsKey("quarter");
        }

        @Test
        @DisplayName("BB-4: quarter-limit email comparison ignores case")
        void quarterLimitComparison_caseInsensitive() {
            String nominator = uniqueEmail("nominator");
            submit(validRequest(nominator, uniqueEmail("first-nominee")));

            ResponseEntity<Map<String, Object>> second = submit(
                    validRequest(nominator.toUpperCase(), uniqueEmail("second-nominee")));

            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        }

        @Test
        @DisplayName("BB-4b: surrounding whitespace on nominatorEmail is rejected by @Email before it ever "
                + "reaches the quarter-limit check (documents that the service layer's trim-tolerance is "
                + "currently unreachable through the real HTTP API)")
        void whitespacePaddedEmail_rejectedByBeanValidation_beforeQuarterCheck() {
            // NominationService.equalsIgnoreCase() trims both sides (verified directly
            // in NominationServiceTest at the unit level), but NominationRequest's
            // @Email constraint on nominatorEmail rejects a value with leading/trailing
            // whitespace at the controller boundary first - so black-box, a padded
            // email never gets far enough to exercise that trimming at all. This is a
            // real discovery, not a copy of BB-4: the two layers disagree about
            // whether padded input is valid, and only the inner one is forgiving.
            String nominator = uniqueEmail("nominator");
            submit(validRequest(nominator, uniqueEmail("first-nominee")));

            String padded = "  " + nominator + "  ";
            ResponseEntity<Map<String, Object>> second = submit(
                    validRequest(padded, uniqueEmail("second-nominee")));

            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(second.getBody()).containsKey("nominatorEmail");
        }
    }

    @Nested
    @DisplayName("BB-5 / BB-6 - not found and double-decision")
    class NotFoundAndDoubleDecision {

        @Test
        @DisplayName("BB-5: GET a random unknown id returns 404 with an error field, no internal leakage")
        void unknownId_returns404() {
            ResponseEntity<Map<String, Object>> response = get(API + "/" + UUID.randomUUID());

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).containsKey("error");
            String errorMessage = String.valueOf(response.getBody().get("error"));
            assertThat(errorMessage).doesNotContain("com.version1.recognition");
            assertThat(errorMessage).doesNotContain("Exception");
        }

        @Test
        @DisplayName("BB-6: approving an already-approved nomination returns 409, distinct from 404")
        void approveTwice_secondCallReturns409() {
            Map<String, Object> submission = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            String id = (String) submit(submission).getBody().get("id");

            Map<String, Object> approveBody = new LinkedHashMap<>();
            approveBody.put("coordinatorEmail", "coordinator@example.com");

            ResponseEntity<Map<String, Object>> first = post(API + "/" + id + "/approve", approveBody);
            assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);

            ResponseEntity<Map<String, Object>> second = post(API + "/" + id + "/approve", approveBody);
            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        }
    }

    @Nested
    @DisplayName("BB-8 / BB-9 / BB-10 - completeness, audit log, retag")
    class CompletenessAuditRetag {

        @Test
        @DisplayName("BB-8: completeness check on a thin nomination returns criteria and a suggested message")
        void completenessOnThinNomination_returnsCriteriaAndMessage() {
            Map<String, Object> thin = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            thin.put("whatText", "Short.");
            thin.put("howText", "Also short.");
            String id = (String) submit(thin).getBody().get("id");

            ResponseEntity<Map<String, Object>> response = get(API + "/" + id + "/completeness");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("complete", false);
            assertThat(response.getBody().get("criteria")).isInstanceOf(List.class);
            assertThat((List<?>) response.getBody().get("criteria")).isNotEmpty();
            assertThat(String.valueOf(response.getBody().get("suggestedMessage"))).isNotBlank();
        }

        @Test
        @DisplayName("BB-9: audit log before any decision is 200 with an empty array, not 404")
        void auditLogBeforeDecision_returns200EmptyArray() {
            Map<String, Object> submission = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            String id = (String) submit(submission).getBody().get("id");

            ResponseEntity<List> response = rest.getForEntity(API + "/" + id + "/audit-log", List.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isEmpty();
        }

        @Test
        @DisplayName("BB-10: retag is idempotent and safely repeatable")
        void retag_idempotentAndRepeatable() {
            submit(validRequest(uniqueEmail("nominator"), uniqueEmail("nominee")));

            ResponseEntity<Map<String, Object>> first = post(API + "/retag", null);
            ResponseEntity<Map<String, Object>> second = post(API + "/retag", null);

            assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(first.getBody()).containsKey("flaggedNominations");
            assertThat(first.getBody()).containsKey("message");
            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    @Nested
    @DisplayName("BB-11 / BB-12 - boundary and malformed input")
    class BoundaryAndMalformed {

        @Test
        @DisplayName("BB-11: an extremely long WHAT/HOW is handled cleanly, never a 500")
        void extremelyLongText_neverA500() {
            Map<String, Object> body = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            body.put("whatText", "x".repeat(50_000));
            body.put("howText", "y".repeat(50_000));

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getStatusCode().is5xxServerError()).isFalse();
        }

        @Test
        @DisplayName("BB-12: malformed JSON body returns a clean 400, never a 500")
        void malformedJsonBody_returns400NotServerError() {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>("{not valid json", headers);

            ResponseEntity<String> response = rest.exchange(API, HttpMethod.POST, entity, String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    @Nested
    @DisplayName("BB-13 / BB-14 - quarter limit only caps the NOMINATOR, and required-field gaps by name")
    class QuotaScopeAndFieldGaps {

        @Test
        @DisplayName("T-13: the same nominee can be nominated by three different nominators in one quarter - "
                + "the quarter limit is scoped to the nominator, not the nominee")
        void sameNomineeThreeDifferentNominators_allSucceed() {
            String nominee = uniqueEmail("shared-nominee");

            ResponseEntity<Map<String, Object>> first = submit(validRequest(uniqueEmail("nominator-1"), nominee));
            ResponseEntity<Map<String, Object>> second = submit(validRequest(uniqueEmail("nominator-2"), nominee));
            ResponseEntity<Map<String, Object>> third = submit(validRequest(uniqueEmail("nominator-3"), nominee));

            assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(third.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }

        @Test
        @DisplayName("T-15: a blank whatText returns 400 naming whatText specifically")
        void blankWhatText_returns400WithWhatTextField() {
            Map<String, Object> body = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            body.put("whatText", "");

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("whatText");
        }

        @Test
        @DisplayName("T-16: a blank howText returns 400 naming howText specifically")
        void blankHowText_returns400WithHowTextField() {
            Map<String, Object> body = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            body.put("howText", "");

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("howText");
        }

        @Test
        @DisplayName("T-17: a blank nomineeEmail returns 400 naming nomineeEmail specifically")
        void blankNomineeEmail_returns400WithNomineeEmailField() {
            Map<String, Object> body = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            body.put("nomineeEmail", "");

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("nomineeEmail");
        }

        @Test
        @DisplayName("T-18: the nominator identity in the response matches exactly what was submitted - "
                + "there's no server-side \"current user\" substitution to go wrong")
        void nominatorIdentity_reflectsSubmittedValuesExactly() {
            String nominatorEmail = uniqueEmail("nominator");
            Map<String, Object> body = validRequest(nominatorEmail, uniqueEmail("nominee"));
            body.put("nominatorName", "Exact Nominator Name");

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getBody()).containsEntry("nominatorName", "Exact Nominator Name");
            assertThat(response.getBody()).containsEntry("nominatorEmail", nominatorEmail);
        }

        @Test
        @DisplayName("T-45: whitespace-only whatText is treated as blank, same as an empty string")
        void whitespaceOnlyWhatText_returns400SameAsBlank() {
            Map<String, Object> body = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            body.put("whatText", "   \n\t  ");

            ResponseEntity<Map<String, Object>> response = submit(body);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("whatText");
        }
    }

    @Nested
    @DisplayName("BB-15 - audit log has no mutation endpoint")
    class AuditLogImmutability {

        @Test
        @DisplayName("T-25: there is no PUT or DELETE on /audit-log - nothing in the public API can alter "
                + "an existing entry")
        void auditLogPath_hasNoMutationVerb() {
            Map<String, Object> submission = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            String id = (String) submit(submission).getBody().get("id");
            String auditPath = API + "/" + id + "/audit-log";

            ResponseEntity<String> putResponse = rest.exchange(
                    auditPath, HttpMethod.PUT, new HttpEntity<>(Map.of()), String.class);
            ResponseEntity<String> deleteResponse = rest.exchange(
                    auditPath, HttpMethod.DELETE, HttpEntity.EMPTY, String.class);

            assertThat(putResponse.getStatusCode().is2xxSuccessful()).isFalse();
            assertThat(deleteResponse.getStatusCode().is2xxSuccessful()).isFalse();
        }
    }

    @Nested
    @DisplayName("BB-16 - concurrent decisions on the same nomination")
    class ConcurrentDecisions {

        @Test
        @DisplayName("T-39 (BUG, pinned as regression): two simultaneous approve calls on the same pending "
                + "nomination BOTH currently succeed with 200 OK, instead of the second being rejected the way "
                + "BB-6's sequential double-approve is (409 CONFLICT). Root cause: NominationService.approve() "
                + "reads the nomination, checks its status, then writes - with no @Version/optimistic lock and "
                + "no row-level lock, two threads can both pass the PENDING_REVIEW check before either writes. "
                + "BB-6 only proves the sequential case is guarded; it never exercised a real race. This test "
                + "pins the CURRENT (buggy) behavior so a fix - the race starting to correctly reject one of the "
                + "two - shows up here as a welcome failure, matching this suite's UI-1a convention.")
        void simultaneousApprove_bothCurrentlySucceed() throws Exception {
            Map<String, Object> submission = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            String id = (String) submit(submission).getBody().get("id");

            Map<String, Object> approveBody = new LinkedHashMap<>();
            approveBody.put("coordinatorEmail", "coordinator@example.com");

            Callable<HttpStatusCode> callApprove =
                    () -> post(API + "/" + id + "/approve", approveBody).getStatusCode();

            ExecutorService pool = Executors.newFixedThreadPool(2);
            try {
                Future<HttpStatusCode> first = pool.submit(callApprove);
                Future<HttpStatusCode> second = pool.submit(callApprove);

                List<HttpStatusCode> results =
                        List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));

                long successCount = results.stream().filter(HttpStatusCode::is2xxSuccessful).count();
                assertThat(successCount)
                        .as("both concurrent approve calls currently win - results were: %s", results)
                        .isEqualTo(2);
            } finally {
                pool.shutdownNow();
            }
        }
    }

    @Nested
    @DisplayName("BB-17 - text content is stored and returned exactly, never executed or corrupted")
    class TextContentFidelity {

        @Test
        @DisplayName("T-43: WHAT text containing a <script> tag is stored and returned as literal text, "
                + "never stripped or transformed - the app.js render layer, not the API, is responsible for "
                + "escaping it on display")
        void scriptTagInWhatText_storedAndReturnedAsLiteralText() {
            String malicious = "Delivered under budget. <script>alert('xss')</script> Great work overall.";
            Map<String, Object> body = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            body.put("whatText", malicious);

            ResponseEntity<Map<String, Object>> submitResponse = submit(body);
            assertThat(submitResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            String id = (String) submitResponse.getBody().get("id");

            ResponseEntity<Map<String, Object>> fetched = get(API + "/" + id);

            assertThat(fetched.getBody()).containsEntry("whatText", malicious);
        }

        @Test
        @DisplayName("T-44: emoji and non-Latin characters in WHAT/HOW round-trip exactly")
        void emojiAndNonLatinText_roundTripsExactly() {
            String what = "Shipped the release early 🎉🚀 - team said 谢谢 and merci beaucoup, très bien joué!";
            String how = "Über engagiert, showed real drive withño hesitación at all, 100% commitment.";
            Map<String, Object> body = validRequest(uniqueEmail("nominator"), uniqueEmail("nominee"));
            body.put("whatText", what);
            body.put("howText", how);

            ResponseEntity<Map<String, Object>> submitResponse = submit(body);
            assertThat(submitResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            String id = (String) submitResponse.getBody().get("id");

            ResponseEntity<Map<String, Object>> fetched = get(API + "/" + id);

            assertThat(fetched.getBody()).containsEntry("whatText", what);
            assertThat(fetched.getBody()).containsEntry("howText", how);
        }
    }
}
