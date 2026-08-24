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

  # UAT-11 used to live here ("EmployeeStatusCheck never flags anyone yet") -
  # it moved to coordinator.feature as UAT-12 once a real user directory made
  # that a genuine, assertable behavior instead of an acknowledged gap.
