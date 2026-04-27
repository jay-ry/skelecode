---
status: partial
phase: 05-enhance-ai-prompts
source: [05-VERIFICATION.md]
started: 2026-04-27T00:00:00Z
updated: 2026-04-27T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sprint card markdown rendering
expected: Generate sprints for a project, verify cards display 10-section markdown (headings, tables, bullet lists) rendered by ReactMarkdown
result: [pending]

### 2. Sprint round-trip via DB
expected: Generate sprints, refresh the page, verify markdown reloads correctly from DB into SprintCard components
result: [pending]

### 3. Legacy DB row fallback
expected: Open a pre-Phase-5 project that has only user_stories/technical_tasks/definition_of_done arrays, verify the legacy Section rendering still works without errors
result: [pending]

### 4. Drafter monetization present
expected: Brainstorm a project mentioning a pricing model (e.g. "subscription, $9/month"), verify project.md includes a `## Monetization` section with `| Tier | Price | Limits |` table
result: [pending]

### 5. Drafter monetization absent
expected: Brainstorm a project without mentioning pricing, verify project.md has NO `## Monetization` section
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
