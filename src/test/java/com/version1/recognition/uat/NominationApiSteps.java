package com.version1.recognition.uat;

import com.version1.recognition.nomination.model.Role;
import com.version1.recognition.nomination.model.User;
import com.version1.recognition.nomination.repository.UserRepository;

import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Step definitions for the UAT feature files. Talks to the real REST API
 * (same TestRestTemplate pattern as NominationApiBlackBoxTest), against the
 * isolated 'blackbox' profile via CucumberSpringConfiguration. Scenario
 * state lives in plain instance fields - cucumber-spring gives each scenario
 * its own instance of this class.
 */
public class NominationApiSteps {

    private static final String API = "/api/nominations";
    private static final String COORDINATOR_EMAIL = "coordinator@example.com";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private UserRepository userRepository;

    private String nominatorEmail;
    private String nominationId;
    private ResponseEntity<Map<String, Object>> lastResponse;
    private String whatText;
    private String howText;

    // The blackbox profile's Spring context (and its in-memory DB) is cached
    // and reused across the whole Cucumber run - same lifecycle as
    // NominationApiBlackBoxTest - so this must be idempotent, not a plain
    // save() on every scenario.
    @Before
    public void seedCoordinatorFixture() {
        if (userRepository.findByEmailIgnoreCase(COORDINATOR_EMAIL).isEmpty()) {
            userRepository.save(new User("Coordinator", COORDINATOR_EMAIL, Role.COORDINATOR, null));
        }
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> post(String path, Object body) {
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>)
                rest.postForEntity(path, body, Map.class);
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> get(String path) {
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>)
                rest.getForEntity(path, Map.class);
    }

    private String uniqueEmail(String label) {
        return label + "-" + UUID.randomUUID() + "@example.com";
    }

    private Map<String, Object> submissionBody(String nominatorEmail, String nomineeEmail,
            String what, String how, UUID originalNominationId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("nominatorName", "Nominator");
        body.put("nominatorEmail", nominatorEmail);
        body.put("nomineeName", "Nominee");
        body.put("nomineeEmail", nomineeEmail);
        body.put("practice", "Cloud Engineering");
        body.put("location", "Dublin");
        body.put("category", "CUSTOMER_IMPACT");
        body.put("coreValue", "DRIVE");
        body.put("whatText", what);
        body.put("howText", how);
        if (originalNominationId != null) {
            body.put("originalNominationId", originalNominationId.toString());
        }
        return body;
    }

    // ---------- Given ----------

    @Given("I am a nominator")
    public void iAmANominator() {
        nominatorEmail = uniqueEmail("uat-nominator");
    }

    @Given("I have already submitted a nomination this quarter")
    public void iHaveAlreadySubmittedThisQuarter() {
        ResponseEntity<Map<String, Object>> response = post(API, submissionBody(
                nominatorEmail, uniqueEmail("uat-first-nominee"),
                "They rebuilt the release pipeline, cutting deploy time from two days to twenty minutes.",
                "They showed real drive, tracing every failure mode themselves without being asked.",
                null));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Given("my nomination was sent back for more detail with a specific reason")
    public void myNominationWasSentBackForDetail() {
        ResponseEntity<Map<String, Object>> submitted = post(API, submissionBody(
                nominatorEmail, uniqueEmail("uat-nominee"), "Short.", "Also short.", null));
        assertThat(submitted.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        nominationId = String.valueOf(submitted.getBody().get("id"));

        Map<String, Object> resubmissionRequest = new LinkedHashMap<>();
        resubmissionRequest.put("coordinatorEmail", COORDINATOR_EMAIL);
        resubmissionRequest.put("reason", "Needs a figure and a named core value evidenced.");
        ResponseEntity<Map<String, Object>> sentBack = post(
                API + "/" + nominationId + "/request-resubmission", resubmissionRequest);
        assertThat(sentBack.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Given("a nomination exists that is pending review")
    public void aNominationExistsPendingReview() {
        whatText = "They redesigned the deployment pipeline from scratch, cutting release "
                + "time from two days down to twenty minutes for the whole team.";
        howText = "They showed real drive, mapping every failure mode themselves without "
                + "being asked and fixing each one before it caused an incident.";
        ResponseEntity<Map<String, Object>> response = post(API, submissionBody(
                uniqueEmail("uat-nominator"), uniqueEmail("uat-nominee"), whatText, howText, null));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        nominationId = String.valueOf(response.getBody().get("id"));
    }

    @Given("a nomination exists whose WHAT and HOW use generic, routine-sounding language")
    public void aNominationExistsWithRoutineLanguage() {
        ResponseEntity<Map<String, Object>> response = post(API, submissionBody(
                uniqueEmail("uat-nominator"), uniqueEmail("uat-nominee"),
                "They completed on time and met the deadline as always.",
                "A real team player who is always helpful.", null));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        nominationId = String.valueOf(response.getBody().get("id"));
    }

    @Given("a nomination exists with thin WHAT and HOW text")
    public void aNominationExistsWithThinText() {
        ResponseEntity<Map<String, Object>> response = post(API, submissionBody(
                uniqueEmail("uat-nominator"), uniqueEmail("uat-nominee"), "Short.", "Also short.", null));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        nominationId = String.valueOf(response.getBody().get("id"));
    }

    @Given("I am acting as a coordinator, with no login of any kind")
    public void iAmActingAsACoordinatorWithNoLogin() {
        // Deliberately a no-op: the point of UAT-9 is that there is nothing
        // to authenticate with. A pending nomination is set up so the next
        // step has something to decide on.
        aNominationExistsPendingReview();
    }

    @Given("a nomination exists for a nominee who is not in the user directory")
    public void aNominationExistsForANomineeNotInTheUserDirectory() {
        // Mechanically identical to aNominationExistsPendingReview() - every
        // uniqueEmail()-generated nominee is, by construction, never a
        // seeded User row - but kept as its own step so this scenario reads
        // self-documentingly.
        ResponseEntity<Map<String, Object>> response = post(API, submissionBody(
                uniqueEmail("uat-nominator"), uniqueEmail("uat-unlisted-nominee"),
                "They redesigned the deployment pipeline from scratch, cutting release "
                        + "time from two days down to twenty minutes for the whole team.",
                "They showed real drive, mapping every failure mode themselves without "
                        + "being asked and fixing each one before it caused an incident.",
                null));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        nominationId = String.valueOf(response.getBody().get("id"));
    }

    // ---------- When ----------

    @When("I submit a Star Award nomination for a colleague with a specific WHAT and HOW")
    public void iSubmitANomination() {
        lastResponse = post(API, submissionBody(nominatorEmail, uniqueEmail("uat-nominee"),
                "They redesigned the deployment pipeline from scratch, cutting release "
                        + "time from two days down to twenty minutes for the whole team.",
                "They showed real drive, mapping every failure mode themselves without "
                        + "being asked and fixing each one before it caused an incident.",
                null));
    }

    @When("I try to submit a second, unrelated nomination this quarter")
    public void iTryToSubmitASecondNomination() {
        lastResponse = post(API, submissionBody(nominatorEmail, uniqueEmail("uat-second-nominee"),
                "A completely different contribution from the first.",
                "A completely different value demonstrated this time.", null));
    }

    @When("I resubmit revised content referencing the original nomination")
    public void iResubmitRevisedContent() {
        lastResponse = post(API, submissionBody(nominatorEmail, uniqueEmail("uat-revised-nominee"),
                "Revised: they rebuilt the deployment checklist end to end, cutting the "
                        + "release window from four hours to twenty minutes.",
                "Revised: this showed real drive, and nobody had to ask them to do it.",
                UUID.fromString(nominationId)));
    }

    @When("a coordinator approves it")
    public void aCoordinatorApprovesIt() {
        Map<String, Object> approveRequest = new LinkedHashMap<>();
        approveRequest.put("coordinatorEmail", COORDINATOR_EMAIL);
        lastResponse = post(API + "/" + nominationId + "/approve", approveRequest);
        assertThat(lastResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @When("I approve it")
    public void iApproveIt() {
        aCoordinatorApprovesIt();
    }

    @When("I reject it with a reason")
    public void iRejectItWithAReason() {
        Map<String, Object> rejectRequest = new LinkedHashMap<>();
        rejectRequest.put("coordinatorEmail", COORDINATOR_EMAIL);
        rejectRequest.put("reason", "Not enough concrete detail to evidence the value claimed.");
        lastResponse = post(API + "/" + nominationId + "/reject", rejectRequest);
        assertThat(lastResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @When("I approve a nomination as that coordinator")
    public void iApproveANominationAsThatCoordinator() {
        aCoordinatorApprovesIt();
    }

    @When("I run the completeness check on it")
    public void iRunTheCompletenessCheck() {
        lastResponse = get(API + "/" + nominationId + "/completeness");
    }

    @When("I look at that nomination")
    public void iLookAtThatNomination() {
        lastResponse = get(API + "/" + nominationId);
    }

    @When("the nomination is tagged")
    public void theNominationIsTagged() {
        lastResponse = get(API + "/" + nominationId);
    }

    // ---------- Then ----------

    @Then("I receive confirmation the nomination was received")
    public void iReceiveConfirmation() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(lastResponse.getBody()).containsKey("id");
        nominationId = String.valueOf(lastResponse.getBody().get("id"));
    }

    @Then("the nomination is pending review")
    public void theNominationIsPendingReview() {
        assertThat(lastResponse.getBody()).containsEntry("status", "PENDING_REVIEW");
    }

    @Then("I am told clearly that I've already used this quarter's nomination")
    public void iAmToldIveAlreadyUsedThisQuartersNomination() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(lastResponse.getBody()).containsEntry("reason", "QUARTER_LIMIT");
    }

    @Then("I am told when I'll be able to submit again")
    public void iAmToldWhenIllBeAbleToSubmitAgain() {
        assertThat(lastResponse.getBody()).containsKey("quarter");
        assertThat(String.valueOf(lastResponse.getBody().get("error"))).isNotBlank();
    }

    @Then("the resubmission is accepted")
    public void theResubmissionIsAccepted() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Then("it does not count against my quarterly limit")
    public void itDoesNotCountAgainstMyQuarterlyLimit() {
        // The resubmission in "myNominationWasSentBackForDetail" already used
        // this nominator's one real submission + a decision (send-back) this
        // quarter. The prior step's 201 CREATED (not 409) is the proof the
        // limit wasn't re-applied - restated here for a self-contained
        // assertion in case step order changes.
        assertThat(lastResponse.getStatusCode()).isNotEqualTo(HttpStatus.CONFLICT);
    }

    @Then("the nominee's comms record includes the WHAT and HOW that were submitted about them")
    public void theNomineesCommsRecordIncludesWhatAndHow() {
        ResponseEntity<List> auditLog = rest.getForEntity(API + "/" + nominationId + "/audit-log", List.class);
        assertThat(auditLog.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> entries = auditLog.getBody();
        assertThat(entries).isNotEmpty();

        List<Map<String, String>> allComms = new java.util.ArrayList<>();
        entries.forEach(e -> {
            @SuppressWarnings("unchecked")
            List<Map<String, String>> comms = (List<Map<String, String>>) e.get("comms");
            if (comms != null) allComms.addAll(comms);
        });

        Map<String, String> nomineeComm = allComms.stream()
                .filter(c -> "NOMINEE".equals(c.get("recipientRole")))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No comms recorded for the nominee"));

        assertThat(nomineeComm.get("body")).contains(whatText);
        assertThat(nomineeComm.get("body")).contains(howText);
    }

    @Then("the nominator separately receives a confirmation of the approval")
    public void theNominatorSeparatelyReceivesConfirmation() {
        ResponseEntity<List> auditLog = rest.getForEntity(API + "/" + nominationId + "/audit-log", List.class);
        List<Map<String, Object>> entries = auditLog.getBody();
        List<Map<String, String>> allComms = new java.util.ArrayList<>();
        entries.forEach(e -> {
            @SuppressWarnings("unchecked")
            List<Map<String, String>> comms = (List<Map<String, String>>) e.get("comms");
            if (comms != null) allComms.addAll(comms);
        });
        boolean hasNominatorComm = allComms.stream().anyMatch(c -> "NOMINATOR".equals(c.get("recipientRole")));
        assertThat(hasNominatorComm).isTrue();
    }

    @Then("it already carries a ROUTINE_TASK_LANGUAGE flag with a reason I can read directly")
    public void itAlreadyCarriesARoutineTaskLanguageFlag() {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> flags = (List<Map<String, Object>>) lastResponse.getBody().get("aiFlags");
        assertThat(flags).anySatisfy(f -> {
            assertThat(f.get("flag")).isEqualTo("ROUTINE_TASK_LANGUAGE");
            assertThat(String.valueOf(f.get("reason"))).isNotBlank();
        });
    }

    @Then("only the nominator's comms record exists, not the nominee's")
    public void onlyTheNominatorsCommsRecordExists() {
        ResponseEntity<List> auditLog = rest.getForEntity(API + "/" + nominationId + "/audit-log", List.class);
        List<Map<String, Object>> entries = auditLog.getBody();
        List<Map<String, String>> allComms = new java.util.ArrayList<>();
        entries.forEach(e -> {
            @SuppressWarnings("unchecked")
            List<Map<String, String>> comms = (List<Map<String, String>>) e.get("comms");
            if (comms != null) allComms.addAll(comms);
        });
        assertThat(allComms).anySatisfy(c -> assertThat(c.get("recipientRole")).isEqualTo("NOMINATOR"));
        assertThat(allComms).noneSatisfy(c -> assertThat(c.get("recipientRole")).isEqualTo("NOMINEE"));
    }

    @Then("the decision is recorded against my email in the audit log")
    public void theDecisionIsRecordedAgainstMyEmail() {
        ResponseEntity<List> auditLog = rest.getForEntity(API + "/" + nominationId + "/audit-log", List.class);
        List<Map<String, Object>> entries = auditLog.getBody();
        assertThat(entries).anySatisfy(e -> assertThat(e.get("coordinatorEmail")).isEqualTo(COORDINATOR_EMAIL));
    }

    @Then("it tells me the nomination is not complete")
    public void itTellsMeTheNominationIsNotComplete() {
        assertThat(lastResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(lastResponse.getBody()).containsEntry("complete", false);
    }

    @Then("it gives me a ready-to-send message listing what to add")
    public void itGivesMeAReadyToSendMessage() {
        assertThat(String.valueOf(lastResponse.getBody().get("suggestedMessage"))).isNotBlank();
    }

    @Then("the audit log for that nomination shows my email, the action, and a timestamp")
    public void theAuditLogShowsMyEmailActionAndTimestamp() {
        ResponseEntity<List> auditLog = rest.getForEntity(API + "/" + nominationId + "/audit-log", List.class);
        List<Map<String, Object>> entries = auditLog.getBody();
        assertThat(entries).isNotEmpty();
        Map<String, Object> entry = entries.get(0);
        assertThat(entry.get("coordinatorEmail")).isEqualTo(COORDINATOR_EMAIL);
        assertThat(entry.get("action")).isEqualTo("APPROVED");
        assertThat(entry.get("occurredAt")).isNotNull();
    }

    @Then("the API accepts the decision on the coordinator email alone, with no credential check")
    public void theApiAcceptsTheDecisionWithNoCredentialCheck() {
        // UAT-9's point: there is no Authorization header, no session, no
        // token anywhere in this whole scenario - and the 200 already
        // asserted in aCoordinatorApprovesIt() is the proof. Restated here
        // for a self-contained assertion.
        assertThat(lastResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Then("a comms record exists with the exact subject and body that would be sent")
    public void aCommsRecordExistsWithExactSubjectAndBody() {
        ResponseEntity<List> auditLog = rest.getForEntity(API + "/" + nominationId + "/audit-log", List.class);
        List<Map<String, Object>> entries = auditLog.getBody();
        List<Map<String, String>> allComms = new java.util.ArrayList<>();
        entries.forEach(e -> {
            @SuppressWarnings("unchecked")
            List<Map<String, String>> comms = (List<Map<String, String>>) e.get("comms");
            if (comms != null) allComms.addAll(comms);
        });
        assertThat(allComms).isNotEmpty();
        assertThat(allComms).allSatisfy(c -> {
            assertThat(String.valueOf(c.get("subject"))).isNotBlank();
            assertThat(String.valueOf(c.get("body"))).isNotBlank();
        });
    }

    @Then("nothing in the API response claims an email was actually delivered")
    public void nothingClaimsAnEmailWasActuallyDelivered() {
        // There is no "delivered"/"sent"/"emailed" field anywhere in
        // NominationResponse or AuditLogEntryResponse - only "comms", which
        // is the composed-and-logged record, and commsSentDate, which the
        // code comments are explicit means "composed", not delivered.
        assertThat(lastResponse.getBody()).doesNotContainKey("delivered");
        assertThat(lastResponse.getBody()).doesNotContainKey("emailSent");
    }

    @Then("it already carries a NOMINEE_NOT_ACTIVE_EMPLOYEE flag with a reason I can read directly")
    public void itAlreadyCarriesANomineeNotActiveEmployeeFlag() {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> flags = (List<Map<String, Object>>) lastResponse.getBody().get("aiFlags");
        assertThat(flags).anySatisfy(f -> {
            assertThat(f.get("flag")).isEqualTo("NOMINEE_NOT_ACTIVE_EMPLOYEE");
            assertThat(String.valueOf(f.get("reason"))).isNotBlank();
        });
    }
}
