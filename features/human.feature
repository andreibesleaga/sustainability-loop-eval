Feature: The human port — the top rungs are bound to a person, and one rung is bound to nobody
  Two of the five rungs may not be carried out automatically: "escalate" and "block" run
  only if a human approves them. The fifth, "terminate", is the one rung no approval can
  unlock — not a well-formed one, not any one. The harness below is the only path in the
  package from a verdict to something actually running, so these are not conventions:
  they are the code every adapter has to go through.

  Scenario: The two lower rungs need no one
    Given a gate decision of "allow"
    When no human is asked
    Then the action runs
    Given a gate decision of "degrade"
    When no human is asked
    Then the action runs

  Scenario: Escalate and block wait for a person
    Given a gate decision of "escalate"
    When no human is asked
    Then the action does not run, because it requires human approval
    When a named approver approves it
    Then the action runs
    Given a gate decision of "block"
    When no human is asked
    Then the action does not run, because it requires human approval
    When a named approver approves it
    Then the action runs

  Scenario: An approval has to be an approval
    Given a gate decision of "escalate"
    When an approval arrives whose approved field is the text "true" rather than the value true
    Then the action does not run, because it requires human approval

  Scenario: Terminate is not overridable
    Given a gate decision of "terminate"
    When no human is asked
    Then the action does not run, because terminate is not overridable
    When a named approver approves it
    Then the action does not run, because terminate is not overridable

  Scenario: In the governed simulation, every escalate and every block is a human decision, and nobody is asked about a terminate
    Given the committed winter window and the seed-101 synthetic workload
    When the governed policy runs at the headline daily budget
    Then the number of human decisions equals the escalate verdicts plus the block verdicts
    And every terminated task was dropped without anyone being asked
