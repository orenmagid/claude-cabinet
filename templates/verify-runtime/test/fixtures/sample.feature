Feature: cabinet-verify pathHash spec fixture

  A 5-step scenario for exercising the path-hash and fresh-pass-cache
  modules. The check IDs (1.01–1.05) follow the de[sic]ify
  quoted-arg convention. The Background block is intentionally present
  to verify that pathHash excludes Background steps from the hash input.

  Background:
    Given the local dev stack is up

  Scenario: Sample five-step flow
    When I navigate to "/app"
    Then check "1.01 workspace-heading-visible" the workspace heading is visible
    And check "1.02 navbar-rewrite-link" the navbar has a Rewrite link
    And check "1.03 article-input-heading" the article-input panel is visible
    And check "1.04 article-textarea-empty" the article textarea is empty
    And check "1.05 upload-button-visible" the upload button is visible
