Feature: The publication port — old documents are still served, and never rewritten to look fresh
  The publication port is the loop's output edge: a system publishes what it consumed and
  emitted, and its peers read it. The measured reality of that edge is age. A published
  document is served exactly as its publisher left it, however long ago that was — so a
  system acting on its peers' documents is acting on a picture whose age it can read, and
  nothing anywhere invents a fresher one. The scenarios run against the documents the
  reference gateway actually served, checked against a fixed reference date so the numbers
  are reproducible, and against the member set the closed-loop run derives from them.

  Scenario: What the loop publishes has the shape the real gateway serves
    Given the sustainability documents the reference gateway actually served
    Then the member set the loop requires at publication is derived from those documents themselves, not hard-coded
    And it contains the members that say who published, when, for what period, and how it was measured

  Scenario: Documents older than any control cadence are still served, and stay honest about their age
    Given the sustainability documents the reference gateway actually served
    And a fixed reference date of 2026-08-21
    Then every served document is more than a day old, far older than the loop's 30-minute cadence
    And the oldest of them is more than half a year old, and is still served exactly as published
    And each carries its publisher's own updated timestamp, a real instant, neither invented nor refreshed
    And every one of them still carries every member the loop requires at publication

  Scenario: The member a control loop most needs is the one fewest publishers carry
    Given the sustainability documents the reference gateway actually served
    Then fewer than half of them carry a carbon-intensity member
    And more of them carry their energy consumption than carry their intensity
