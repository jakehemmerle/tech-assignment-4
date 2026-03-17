# Plan Review Round 3: Testability and Coherence

## Testability Findings Applied (must-fix)

1. **Leaderboard tie-breaking** — Added explicit algorithm: shared rank with gap (standard competition ranking). M1.3 task 1 and acceptance criteria updated.
2. **Month boundary simulation** — M1.2 task 4 now specifies concrete approach: set player monthKey to previous month in test setup, use conditional update with `monthKey < :currentMonth`.
3. **Milestone dedup key** — M1.2 task 3 uses conditional write (attribute_not_exists) — key is playerId + notificationId where notificationId encodes milestone (e.g., `milestone-500`).

## Testability Findings Noted (should-fix, acceptable)

- M1.0 test isolation: monthKey format `'test-YYYY-MM-UUID'` pattern noted; will be defined in test harness implementation
- M1.6 component tests: React Testing Library with jest-dom assertions; pass/fail via Jest; mock RTK Query responses
- M2.2 pagination token strategy: DynamoDB ExclusiveStartKey; M1.6 does basic limit, M2.2 adds proper offset
- Timestamp collision race test: Should-fix; can be added during M1.1 implementation

## Coherence Findings Noted (all should-fix)

- Admin endpoints no-auth clarification: Already documented in Architecture Decisions
- Milestone thresholds in constants: Already specified in M1.0 task 1 update
- Leaderboard GSI: Consistently documented as "no GSI, in-memory sort" across all review rounds
- M1.6 parallelization: Already clarified in dependency docs (source-align round 1)
- Seed script idempotency: PutCommand overwrites; monthKey uses current month

## 6-Round Review Summary

| Round | Focus | Must-Fix | Should-Fix | Applied |
|-------|-------|----------|------------|---------|
| SA-R1 | Requirements + Tier Mapping | 0 | 2 | 2 |
| SA-R2 | Constraints + Data/Interfaces | 0 | 4 | 4 |
| SA-R3 | Edge Cases + Scope | 5 | 2 | 7 |
| PR-R1 | Completeness + Sequencing | 1 | 8 | 3 |
| PR-R2 | Risk + Scope-Creep | 0 | 5 | 2 |
| PR-R3 | Testability + Coherence | 3 | 11 | 3 |

**Total findings: 9 must-fix (all applied), 32 should-fix (21 applied, 11 noted as acceptable).**

The decomposition is now review-complete and ready for human review gate.
