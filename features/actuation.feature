Feature: The actuation port — a refusal withholds the optimisation, never the power
  This is the safety invariant of the gated EV-charging experiment (E3), and it is the
  one a regulator should read first. The only thing the agent is ever allowed to change
  is WHEN a full charge starts, inside the driver's own plug-in window. There is no
  discharge, no vehicle-to-grid, no state-of-charge logic. So when the gate refuses, or
  when the owner refuses, the car does not charge less, or later than its deadline, or
  not at all: it simply charges the way it would have without any of this — naively, on
  plug-in. The scenarios run the real fleet simulation over the real winter trace.

  Scenario: When the owner refuses every proposal, every car is still fully charged
    Given the committed winter window and the deterministic plug-in schedule for seed 101
    When the governed fleet runs with the owner refusing every proposal
    Then no charging session is moved
    And every charging session still receives its full charge
    And the fleet's emissions are exactly the ungoverned baseline's

  Scenario: When the gate refuses every proposal, every car is still fully charged
    Given the committed winter window and the deterministic plug-in schedule for seed 101
    When the daily carbon budget is so small that the gate terminates every proposal
    Then the gate refuses every session and no approval is ever requested
    And every charging session still receives its full charge
    And the fleet's emissions are exactly the ungoverned baseline's

  Scenario: A terminate verdict is never actuated, however many of them there are
    Given the committed winter window and the seed-101 synthetic workload
    When the governed policy runs with a budget so small that every task is terminated
    Then no task runs and every task is dropped
    And no task is lost: completed plus dropped equals the number of tasks

  Scenario: Every action goes through the one harness, and a deferred action is not a second decision
    Given the committed winter window and the seed-101 synthetic workload
    When the governed policy runs at the headline daily budget
    Then the audit chain is valid and holds exactly one gate decision per task
