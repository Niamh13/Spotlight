Feature: Known-gap acceptance criteria

  These document what stakeholders are explicitly signing off as NOT yet
  built, so a UAT pass reflects reality rather than assuming the README's
  "Known gaps" section doesn't exist.

  Scenario: UAT-9 - there is no authentication yet, only a view switch
    Given I am acting as a coordinator, with no login of any kind
    When I approve a nomination as that coordinator
    Then the API accepts the decision on the coordinator email alone, with no credential check

  Scenario: UAT-10 - no real email is sent; comms are composed and logged only
    Given a nomination exists that is pending review
    When a coordinator approves it
    Then a comms record exists with the exact subject and body that would be sent
    But nothing in the API response claims an email was actually delivered

  Scenario: UAT-11 - EmployeeStatusCheck never flags anyone yet (no HR feed wired up)
    Given a nomination exists for any nominee, active or not
    When the nomination is tagged
    Then it never carries a NOMINEE_NOT_ACTIVE_EMPLOYEE flag
