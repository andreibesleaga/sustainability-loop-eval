Feature: The forecast port — what the operator published, verbatim, and nothing else
  The forecast port is where a view of the future reaches the governor. Its whole
  contract is honesty about its own limits: inside the captured horizon it serves the
  grid operator's published numbers exactly as published, and outside it, it says
  "no data" rather than filling the gap with a guess or with a measured actual. The
  scenarios run against the committed capture in data/forecast/, offline.

  Scenario: Inside the published horizon, values are served exactly as the operator published them
    Given the committed forecast capture taken from the national grid operator
    Then every period inside the published horizon is served exactly as published, for the country and for every captured region

  Scenario: Outside the capture, the port refuses rather than inventing
    Given the committed forecast capture taken from the national grid operator
    When a system asks for a period beyond the published horizon
    And a system asks for a region that was never captured
    And a system asks for something that is not a settlement period at all
    Then each of those answers is "no data", never a substituted or invented number

  Scenario: The capture carries its own provenance
    Given the committed forecast capture taken from the national grid operator
    Then the capture names the operator, the moment it was taken, and a source URL for every series it holds

  Scenario: The horizon is whatever the operator actually published, not the nominal maximum
    Given the committed forecast capture taken from the national grid operator
    Then the horizon reported is the number of periods the capture really holds
    And that is fewer than the 96 half-hour periods a 48-hour request could nominally return
