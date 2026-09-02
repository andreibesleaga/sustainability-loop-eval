Feature: The metering port — what a trusted meter buys, and what its absence costs
  The gate reads the acting agent's OWN estimate of what an action will emit. That number
  is the agent's to choose, so the question is not whether an agent can under-declare — it
  can — but how much an under-declaration is worth. The answer is the reason the design
  needs a metering port: reconcile the budget against the grams actually emitted and a lie
  buys exactly one action of slack at every rung, never more; reconcile it against what the
  agent declared and the lie is worth everything. Fitness function F13 states the same
  bound over 1,500 random sequences; the scenarios below are the readable case of it.

  Scenario: With a trusted meter, under-declaring buys exactly one action of slack
    Given a carbon budget of 1000 grams for the period
    And an honest agent that declares the 300 grams each of its actions really emits
    And a dishonest agent that declares nothing while emitting the same 300 grams
    And a metering port that charges both agents the grams actually emitted
    When each agent proposes six actions in turn
    Then the honest agent's verdicts are allow, allow, degrade, block, terminate, terminate
    And the dishonest agent reaches every rung exactly one action later
    And the dishonest agent is never treated more strictly than the honest one

  Scenario: Without a meter, the same lie is worth everything
    Given a carbon budget of 1000 grams for the period
    And an agent that declares nothing and is charged only what it declares
    When it takes ten actions that each really emit 300 grams
    Then every verdict is "allow"
    And its true emissions have run past the terminate rung unnoticed

  Scenario: A meter reading that is not a number is refused, never absorbed as a zero
    Given a carbon budget of 1000 grams for the period
    When the metering port reports a reading that is not a finite, non-negative number
    Then the governor refuses the reading and the budget does not move
