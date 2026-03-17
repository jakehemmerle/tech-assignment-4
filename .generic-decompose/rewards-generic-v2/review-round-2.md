# Plan Review Round 2: Risk and Scope-Creep

## Risk Findings Applied

1. **Notification failure policy** (should-fix → applied): M1.2 task 2 now specifies fire-and-forget policy — notification write failures are logged but do not rollback points awards.
2. **Milestone deduplication** (should-fix → applied): M1.2 task 3 now uses conditional write (attribute_not_exists) instead of read-before-write for dedup.
3. **Admin override tier validation**: Noted — admin overrides are intentionally exempt from floor protection (admin should be able to set any tier). This is acceptable.

## Risk Findings Noted

- Concurrent award race conditions: Timestamp collision strategy already in M1.1 task 4 (append counter). Integration test for concurrent writes is a should-fix that can be added during M1.1 implementation.
- Boundary condition test cases ($0.25, $1.00, $5.00 exact): Already specified in IF1 boundaries. Should be explicit in M1.1 task 3 test cases.
- API versioning: Deferred to M2.5 with note that v1 is frozen.

## Scope-Creep Findings Applied

None required immediate action. Scope is lean.

## Scope-Creep Findings Noted

- Admin leaderboard (M1.5 task 4): Low ROI since player leaderboard already returns playerId. Keeping it because spec explicitly requires it.
- API docs in M2.5: Could split from tier timeline. Keeping bundled for simplicity (single M2 epic).
- Tier-history as separate table: CUT option noted (could store on leaderboard entries instead), but keeping separate table for clarity. Minimal overhead.
