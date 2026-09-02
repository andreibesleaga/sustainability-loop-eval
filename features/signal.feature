Feature: The signal port — readings come in, a verdict comes out, and a missing reading is never a green light
  The signal port is where the outside world's carbon readings reach the governor: the
  peers' published forecast, which is all an agent can actually see when it decides, and
  the national actual series, which is the only thing emissions are ever scored against.
  Every scenario below runs against the real kaiban-distributed ActionGate with the
  Carbon-Verdict Governor plugged in as a validator — nothing here is a stand-in.

  Scenario: A real window of readings arrives with its provenance, and deciding is kept apart from scoring
    Given the committed winter window of real grid-carbon readings
    Then the readings used to decide are the peers' published forecast and the readings used to score are the national actual
    And every reading in the window is a finite, non-negative number
    And the window records which operator published it and where each series came from

  Scenario: Rising commitment climbs the five rungs in order
    Given a carbon budget of 1000 grams for the period
    When an agent proposes an action estimated at 700 grams
    Then the gate answers "allow"
    When an agent proposes an action estimated at 850 grams
    Then the gate answers "degrade"
    When an agent proposes an action estimated at 1000 grams
    Then the gate answers "escalate"
    When an agent proposes an action estimated at 1150 grams
    Then the gate answers "block"
    When an agent proposes an action estimated at 1300 grams
    Then the gate answers "terminate"

  Scenario: When several checks disagree, the most severe one wins and is shown first
    Given a carbon budget of 1000 grams for the period
    And three further checks that answer "allow", "degrade" and "terminate"
    When an agent proposes an action estimated at 0 grams
    Then the gate answers "terminate"
    And the verdict that decided it is the first one listed

  Scenario: A missing or unusable reading is refused, never allowed
    Given a carbon budget of 1000 grams for the period
    When the agent's estimate is missing, not a number, or negative
    Then every one of those proposals is refused with "block"

  Scenario: A check that breaks fails closed
    Given a carbon budget of 1000 grams for the period
    And a further check that fails with an error
    When an agent proposes an action estimated at 0 grams
    Then the gate answers "block"

  Scenario: A verdict that is not on the ladder cannot mask a terminate
    Given a carbon budget of 1000 grams for the period
    And two further checks, the first answering something that is not a rung at all and the second answering "terminate"
    When an agent proposes an action estimated at 0 grams
    Then the shipped gate on its own would have answered "allow"
    And the recorded answer is "terminate"
    And the reason says the off-ladder verdict was treated as a block, fail closed
