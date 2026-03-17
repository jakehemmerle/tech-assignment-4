# Source Alignment Round 3: Edge Cases, Scope, Failure Modes

## Edge Cases and Failure Modes Review

### Findings Applied (must-fix):

1. **Lazy reset moved to M1.2** — Monthly reset with floor protection is now in M1 critical path so M1 demonstrates a complete tier cycle. M2.1 reduced to bulk admin endpoint only.

2. **Tier override expiry enforcement** — Added M1.2 task 5: on player read, if tierOverride.expiresAt < now, clear override and recalculate tier. Prevents stale overrides persisting.

3. **Timestamp collision in concurrent points awards** — Added to M1.1 task 4: collision resolution strategy (append incrementing counter to epoch ms if collision on same-player writes).

4. **Admin adjustment negative points validation** — M1.5 task 3 now validates debit cannot reduce monthlyPoints or lifetimePoints below 0.

5. **E2E integration test moved to M1.2** — Full points award → tier change → notification → lazy reset cycle tested in M1, not deferred to M2.5.

### Findings Applied (should-fix):

1. **Milestone notification deduplication** — M1.2 task 3 now includes dedupe check before creating milestone notifications.

2. **Lazy reset race condition** — M1.2 task 4 uses conditional update on monthKey to prevent double-reset.

### Noted but acceptable:

- Leaderboard tier field staleness — tier field on leaderboard entry updated on each points award, which is frequent enough
- Seed script idempotency — acceptable for dev tooling; re-run overwrites via PutCommand
- Admin tier override expiry without async job — enforced on read path (acceptable for challenge scope)
- Leaderboard month boundary cleanup — old months persist but don't affect queries (partitioned by monthKey)

## Scope Discipline Review

### SCOPE-CREEP (must-fix, applied):

1. **Monthly reset missing from M1** — Moved lazy reset from M2.1 into M1.2. M1 now demonstrates a complete monthly cycle including floor protection and tier-history writes.

2. **E2E integration test in M2.5** — Moved to M1.2 task 9. M1 now validates the full critical path.

### BORDERLINE (should-fix, noted):

1. **RTK Query setup in M1.6** — Could move to M1.0 for better parallelization. Left in M1.6 since it's the only consumer and the team size is 1 (polecats work sequentially on the critical path anyway).

### All other epics: CLEAN — appropriately scoped, no gold-plating detected.
