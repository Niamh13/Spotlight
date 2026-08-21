Feature: Nominee acceptance criteria

  As a nominee, when I'm approved for a Star Award I want to see exactly
  what was said about me, not just a bare notification.

  Scenario: UAT-4 - an approved nominee receives the full nomination text
    Given a nomination exists that is pending review
    When a coordinator approves it
    Then the nominee's comms record includes the WHAT and HOW that were submitted about them
    And the nominator separately receives a confirmation of the approval
