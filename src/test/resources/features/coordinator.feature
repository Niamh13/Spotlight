Feature: Coordinator acceptance criteria (Epic 3 - review, Epic 6 - dashboard)

  As a recognition coordinator, I want to review nominations efficiently,
  see automatic flags without digging, and keep a clear audit trail.

  Scenario: UAT-5 - flags raised by the rules are visible without extra digging
    Given a nomination exists whose WHAT and HOW use generic, routine-sounding language
    When I look at that nomination
    Then it already carries a ROUTINE_TASK_LANGUAGE flag with a reason I can read directly

  Scenario: UAT-6 - a decision is recorded, and the nominee is never told about a rejection
    Given a nomination exists that is pending review
    When I reject it with a reason
    Then only the nominator's comms record exists, not the nominee's
    And the decision is recorded against my email in the audit log

  Scenario: UAT-7 - the completeness check gives ready-to-send wording in one click
    Given a nomination exists with thin WHAT and HOW text
    When I run the completeness check on it
    Then it tells me the nomination is not complete
    And it gives me a ready-to-send message listing what to add

  Scenario: UAT-8 - I can see a full audit trail of who decided what, and when
    Given a nomination exists that is pending review
    When I approve it
    Then the audit log for that nomination shows my email, the action, and a timestamp

  Scenario: UAT-12 - a nomination for someone outside the user directory is flagged, not blocked
    Given a nomination exists for a nominee who is not in the user directory
    When I look at that nomination
    Then it already carries a NOMINEE_NOT_ACTIVE_EMPLOYEE flag with a reason I can read directly
