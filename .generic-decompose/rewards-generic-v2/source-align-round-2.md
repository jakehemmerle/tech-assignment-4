# Source Alignment Round 2: Constraints, Architecture, Data, Interfaces

## Constraints and Architecture Review

All hard constraints RESPECTED. No violations. Three should-fix items (all minor):

1. API documentation timing — acceptable in M2 given 30-hour scope
2. DTO validation framework choice — deferred to M1.1 implementation (manual validation sufficient)
3. Tier-history table design documented and justified

### Constraint Compliance: All 20+ constraints verified as respected.

## Data and Interface Review

All core data structures (DS1-DS5) well-defined with exact attributes and types.

### Findings Applied:

1. **IF1 (calculateBasePoints)** — FIXED: Clarified exact boundary behavior. BB ≤ 0.25 → 1, 0.25 < BB ≤ 1.00 → 2, etc. Invalid/zero BB → 1.

2. **IF5 timestamp collision** — FIXED: Added collision resolution strategy to M1.1 task 4 (append incrementing counter to epoch ms).

3. **IF11 race condition** — FIXED: Added conditional update on monthKey to prevent double-reset. Moved lazy reset into M1.2 with explicit race protection.

4. **Admin adjustment validation** — FIXED: M1.5 task 3 now validates debit cannot reduce points below 0.

### Should-fix items noted but not blocking:
- Response DTO shapes (PlayerRewardsDTO, PointsHistoryDTO) — will be defined during M1.6 implementation
- Leaderboard rank assignment strategy — position-based, computed at query time
- Milestone/notification type constants — will be defined in M1.0 constants.js update
