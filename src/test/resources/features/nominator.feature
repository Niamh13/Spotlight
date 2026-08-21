Feature: Nominator acceptance criteria (Epic 1 - submission)

  As a nominator, I want to recognise a colleague's contribution and
  understand the rules around how often I can do that.

  Scenario: UAT-1 - submitting a Star Award gets confirmation it was received
    Given I am a nominator
    When I submit a Star Award nomination for a colleague with a specific WHAT and HOW
    Then I receive confirmation the nomination was received
    And the nomination is pending review

  Scenario: UAT-2 - I can't submit more than one nomination in a quarter
    Given I am a nominator
    And I have already submitted a nomination this quarter
    When I try to submit a second, unrelated nomination this quarter
    Then I am told clearly that I've already used this quarter's nomination
    And I am told when I'll be able to submit again

  Scenario: UAT-3 - a sent-back nomination can be fixed without starting over
    Given I am a nominator
    And my nomination was sent back for more detail with a specific reason
    When I resubmit revised content referencing the original nomination
    Then the resubmission is accepted
    And it does not count against my quarterly limit
