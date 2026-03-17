# Project Decomposition: rewards-generic-v2

## Overview

A poker loyalty rewards system built on an existing Express/serverless skeleton. The system awards points per hand based on table stakes, manages four-tier progression with monthly resets, provides leaderboards, notifications, admin tools, and a React dashboard. Three consumers: web dashboard, Unity REST API, admin back-office.

## Architecture Decisions

1. **Stay on Express** — The skeleton provides Express via serverless-http. No NestJS migration (spec permits deviation). This saves significant time.
2. **Existing module pattern** — `src/routes/`, `src/services/`, `src/config/`, `src/middleware/`. No new patterns.
3. **DynamoDB tables as specified** — Four tables from Docker init: `rewards-players`, `rewards-transactions`, `rewards-leaderboard`, `rewards-notifications`. No additional tables except optionally `rewards-tier-history` for the 6-month timeline.
4. **Leaderboard: write-time update** — Update `rewards-leaderboard` entry on every points award. Query and sort in-memory for top-100 (table scan on single monthKey partition — acceptable scale).
5. **Monthly reset: lazy + manual** — Lazy reset on player read (check monthKey freshness) + manual admin endpoint for bulk reset. No cron/Lambda scheduler.
6. **Player auto-creation** — `POST /points/award` creates Bronze player if not found.
7. **Admin auth: open** — No auth guard on admin routes. Scope says no admin UI needed.
8. **Frontend: RTK Query** — Replace raw axios with RTK Query for API layer. Keep MUI for components.
9. **Tier timeline: dedicated store** — Write a tier-history record per player per month on tier change and monthly reset, rather than deriving from transactions.

## Scaffold and Validation Foundation

Before feature work, ensure:
- Docker Compose `--profile rewards` starts cleanly with all four DynamoDB tables
- DynamoDB init script creates any needed GSIs (monthlyPoints sort on leaderboard)
- Jest test harness with DynamoDB Local connection for integration tests
- Seed script rewritten to match actual data model
- Shared DynamoDB service layer updated with correct table references
- Frontend dev server runs and renders placeholder

## Data Structure Inventory

### DS1: PlayerRewardsProfile (`rewards-players`)
- Exact structure name: DynamoDB item in `rewards-players` table
- Purpose: Player's current rewards state
- Attributes:
  - `playerId: String (PK)` — Player GUID
  - `displayName: String` — Display name
  - `currentTier: Number` — 1 (Bronze), 2 (Silver), 3 (Gold), 4 (Platinum)
  - `monthlyPoints: Number` — Points in current calendar month
  - `lifetimePoints: Number` — All-time total
  - `tierFloor: Number` — Minimum tier after reset (previous month protection)
  - `lastTierChangeAt: String` — ISO timestamp
  - `monthKey: String` — Current tracking month (YYYY-MM)
  - `tierOverride: Object | null` — `{ tier: Number, expiresAt: String }` for admin overrides
  - `createdAt: String` — ISO timestamp
  - `updatedAt: String` — ISO timestamp
- Invariants: currentTier in [1,4], monthlyPoints >= 0, lifetimePoints >= 0, tierFloor in [1,4]
- Used by epics: M1.1, M1.2, M1.3, M1.5, M2.1

### DS2: PointsTransaction (`rewards-transactions`)
- Exact structure name: DynamoDB item in `rewards-transactions` table
- Purpose: Immutable points ledger
- Attributes:
  - `playerId: String (PK)` — Player GUID
  - `timestamp: Number (SK)` — Epoch ms
  - `type: String` — `gameplay` | `adjustment` | `bonus`
  - `basePoints: Number` — Pre-multiplier
  - `multiplier: Number` — Tier multiplier at earn time
  - `earnedPoints: Number` — basePoints × multiplier
  - `tableId: Number | null` — Game table ID
  - `tableStakes: String | null` — e.g., "2/5"
  - `handId: String | null` — Hand identifier
  - `monthKey: String` — YYYY-MM
  - `reason: String | null` — For adjustments
  - `createdAt: String` — ISO timestamp
- Invariants: earnedPoints = basePoints × multiplier, immutable (no updates/deletes)
- Used by epics: M1.1, M1.2, M1.5, M2.2

### DS3: LeaderboardEntry (`rewards-leaderboard`)
- Exact structure name: DynamoDB item in `rewards-leaderboard` table
- Purpose: Monthly ranking data
- Attributes:
  - `monthKey: String (PK)` — YYYY-MM
  - `playerId: String (SK)` — Player GUID
  - `displayName: String` — Display name
  - `tier: Number` — Current tier at time of update
  - `monthlyPoints: Number` — Monthly total
- Invariants: One entry per player per month, updated on each points award
- Used by epics: M1.3, M2.3

### DS4: Notification (`rewards-notifications`)
- Exact structure name: DynamoDB item in `rewards-notifications` table
- Purpose: Player notifications
- Attributes:
  - `playerId: String (PK)` — Player GUID
  - `notificationId: String (SK)` — UUID
  - `type: String` — `tier_upgrade` | `tier_downgrade` | `milestone`
  - `title: String` — Display title
  - `description: String` — Body text
  - `dismissed: Boolean` — Default false
  - `createdAt: String` — ISO timestamp
- Invariants: notificationId unique per player
- Used by epics: M1.4, M2.4

### DS5: TierHistory (`rewards-tier-history` — new table or attribute)
- Purpose: Monthly tier snapshots for timeline display
- Approach: Add as a separate DynamoDB table or store as items in rewards-players with a different sort pattern. Simplest: store in a new table.
- Attributes:
  - `playerId: String (PK)` — Player GUID
  - `monthKey: String (SK)` — YYYY-MM
  - `tier: Number` — Tier at end of month
  - `monthlyPoints: Number` — Points earned that month
  - `createdAt: String` — ISO timestamp
- Used by epics: M1.2 (lazy reset writes), M2.1 (bulk reset writes), M2.5 (reads for timeline)

## Core Interface Inventory

### IF1: calculateBasePoints(bigBlind: number): number
- Type: Pure function in points service
- Maps BB to base points: BB ≤ 0.25 → 1, 0.25 < BB ≤ 1.00 → 2, 1.00 < BB ≤ 5.00 → 5, BB > 5.00 → 10
- Boundaries: exact threshold values map to the lower bracket (e.g., $0.25 → 1pt, $1.00 → 2pt, $5.00 → 5pt)
- Error: Invalid/negative/zero BB → 1 (minimum)
- Used by: M1.1

### IF2: calculateEarnedPoints(basePoints: number, multiplier: number): number
- Type: Pure function
- Returns: Math.floor(basePoints * multiplier)
- Used by: M1.1

### IF3: getTierForPoints(monthlyPoints: number): { tier: number, name: string, multiplier: number }
- Type: Pure function
- Returns tier object for given monthly points total
- Used by: M1.1, M1.2

### IF4: getNextTier(currentTier: number): { tier: number, name: string, threshold: number } | null
- Type: Pure function
- Returns next tier info or null if at Platinum
- Used by: M1.2, M1.6

### IF5: POST /api/v1/points/award
- Request: `{ playerId, tableId, tableStakes, bigBlind, handId }`
- Response: `{ playerId, transaction: DS2, player: { currentTier, monthlyPoints, lifetimePoints } }`
- Side effects: writes DS2, updates DS1, updates DS3, may create DS4
- Used by: M1.1, M1.2

### IF6: GET /api/v1/player/rewards
- Headers: X-Player-Id
- Response: `{ playerId, currentTier, tierName, monthlyPoints, lifetimePoints, pointsToNextTier, nextTierName, multiplier, tierFloor }`
- Used by: M1.6

### IF7: GET /api/v1/player/rewards/history?limit=N&offset=N
- Headers: X-Player-Id
- Response: `{ transactions: DS2[], total, limit, offset }`
- Used by: M1.6, M2.2

### IF8: GET /api/v1/leaderboard?limit=N
- Optional header: X-Player-Id (for self-rank)
- Response: `{ leaderboard: Array<{ rank, playerId, displayName, tier, monthlyPoints }>, playerRank?: {...} }`
- Used by: M1.3

### IF9: GET/PATCH /api/v1/player/notifications
- GET: `?unread=true` → `{ notifications: DS4[], unreadCount: number }`
- PATCH `/:notificationId/dismiss` → `{ success: true }`
- Used by: M1.4, M2.4

### IF10: Admin endpoints (GET/POST under /admin/)
- Used by: M1.5

### IF11: resetPlayerMonth(playerId): Promise<PlayerRewardsProfile>
- Lazy reset function called on player read when monthKey is stale
- Uses conditional update on monthKey to prevent double-reset race conditions
- Used by: M1.2 (lazy reset), M2.1 (bulk reset reuses this)

### IF12: POST /admin/monthly-reset
- Bulk reset all players
- Used by: M2.1

## Milestone Summary

| Milestone | Epics | Est. Tasks | What It Proves |
|-----------|-------|------------|----------------|
| M1 (Minimum / Pass) | 7 | ~30 | Core points engine, tier progression, leaderboard, dashboard, notifications, admin, Unity endpoints all work end-to-end. Tests pass. Docker Compose up works. |
| M2 (Strong) | 5 | ~18 | Pagination, self-rank, notification dismiss, monthly reset, tier timeline, integration tests, API docs. Polish and robustness. |

## M1: Minimum / Pass

### Epic M1.0: Scaffold and Data Model Foundation
**Tracer bullet:** Docker Compose up → DynamoDB tables exist with correct schema → seed script populates realistic data → existing health test passes
**Depends on:** None
**Parallelizable with:** None (foundation for everything)
**Data structures:** DS1, DS2, DS3, DS4
**Interfaces:** None
**Validation mode:** integration + manual
**Human checkpoint:** `docker compose --profile rewards up` succeeds, `npm test` passes, `node scripts/seed-rewards.js` populates data

**Tasks:**
1. [ ] Update `src/config/constants.js` — Replace stub tier/point definitions with spec-accurate values (stakes-based points, four tiers with correct thresholds/multipliers, milestone points array, notification type constants). Also define table name constants sourced from environment variables.
2. [ ] Update `src/services/dynamo.service.js` — Add table references for leaderboard and notifications tables, add CRUD methods for all four tables plus tier-history
3. [ ] Update DynamoDB init in `docker-compose.yml` — Add `rewards-tier-history` table creation (PK=playerId, SK=monthKey). Verify rewards-leaderboard table can support sort by monthlyPoints (in-memory sort for top-100 is acceptable; no GSI required at this scale).
4. [ ] Rewrite `scripts/seed-rewards.js` — Generate 50 players matching DS1 schema, transactions matching DS2, leaderboard entries matching DS3, sample notifications matching DS4. Script must be idempotent (PutCommand overwrites).
5. [ ] Create test harness — Jest setup with DynamoDB Local connection for integration tests. Each test uses unique monthKey or player ID prefix to prevent cross-test pollution. Test utility to create/teardown test data.
6. [ ] Define standard error response format — `{ error: string, message: string, statusCode: number }`. Ensure all route handlers use consistent format for 400/401/404/500 responses.
7. [ ] Verify: Docker Compose up, seed, health test passes

**Acceptance criteria:**
- All DynamoDB tables created with correct key schemas
- Seed script populates all tables with realistic data matching DS1-DS4
- Existing health test still passes
- Test harness can connect to DynamoDB Local

### Epic M1.1: Points Engine (Core Business Logic)
**Tracer bullet:** POST /points/award → calculates correct points → writes immutable transaction → updates player totals → returns correct response
**Depends on:** M1.0
**Parallelizable with:** None (other epics depend on this)
**Data structures:** DS1, DS2, DS3
**Interfaces:** IF1, IF2, IF3, IF5
**Validation mode:** unit + integration
**Human checkpoint:** `curl -X POST /api/v1/points/award` with test data returns correct points

**Tasks:**
1. [ ] Implement `calculateBasePoints(bigBlind)` in points service — pure function, stakes-to-points mapping
2. [ ] Implement `calculateEarnedPoints(basePoints, multiplier)` — pure function
3. [ ] Write unit tests for calculateBasePoints and calculateEarnedPoints — cover all stake brackets and edge cases
4. [ ] Implement points award service function — orchestrates: get/create player (with lazy month reset if monthKey stale), calculate points, write transaction (DS2) with timestamp collision resolution (append incrementing counter to epoch ms if collision), update player totals (DS1), update leaderboard (DS3), check tier advancement
5. [ ] Implement `POST /api/v1/points/award` route handler — validate request body, call service, return response
6. [ ] Write unit tests for tier determination from points
7. [ ] Write integration test for full points award flow (API → DynamoDB → response)

**Acceptance criteria:**
- Points calculated correctly for all stake brackets ($0.10-$0.25 → 1pt, $0.50-$1.00 → 2pt, $2.00-$5.00 → 5pt, $10+ → 10pt)
- Tier multiplier applied correctly (Bronze 1.0x, Silver 1.25x, Gold 1.5x, Platinum 2.0x)
- Transaction written to rewards-transactions (immutable)
- Player monthlyPoints and lifetimePoints updated
- Leaderboard entry updated
- Auto-creates Bronze player if not found

### Epic M1.2: Tier Progression + Lazy Month Reset
**Tracer bullet:** Award enough points to cross Silver threshold → player tier upgrades immediately → notification created → simulate month boundary → lazy reset applies floor protection on next read
**Depends on:** M1.1
**Parallelizable with:** M1.3 (leaderboard can proceed once M1.1 is done)
**Data structures:** DS1, DS4, DS5
**Interfaces:** IF3, IF4, IF11
**Validation mode:** unit + integration
**Human checkpoint:** Award points until tier upgrade → verify tier changed → verify notification exists → award more points and verify new multiplier applied → simulate stale monthKey → verify lazy reset applies

**Tasks:**
1. [ ] Implement tier check in points award flow — after updating monthlyPoints, check if new tier > current tier, update currentTier and lastTierChangeAt so subsequent awards use the new tier's multiplier
2. [ ] Implement notification creation on tier upgrade — create DS4 record with type `tier_upgrade`. Notifications are fire-and-forget: if notification write fails, log the error but do NOT rollback the points award.
3. [ ] Implement milestone notifications — check against milestones (500, 1000, 2500, 5000, 10000 points), create DS4 record with type `milestone`. Deduplicate: use conditional write (attribute_not_exists) to avoid duplicate milestone notifications for same player/milestone.
4. [ ] Implement lazy month reset in player read path — if player.monthKey < currentMonth (YYYY-MM string comparison), apply floor protection (new tier = max(tierFloor, previousTier - 1, 1)), reset monthlyPoints to 0, write tier-history record (DS5), update monthKey, create tier_downgrade notification if tier dropped. Use conditional update (`ConditionExpression: monthKey < :currentMonth`) to prevent double-reset race. Test by setting player monthKey to previous month in test setup.
5. [ ] Implement tier override expiry check — on player read, if tierOverride exists and expiresAt < now, clear tierOverride and recalculate tier from monthlyPoints
6. [ ] Write unit tests for tier progression logic — crossing each threshold, already at max tier, exact threshold value
7. [ ] Write unit test verifying multiplier change after tier upgrade — award points to cross Silver, then verify next award uses 1.25x multiplier
8. [ ] Write unit tests for lazy reset floor protection — Platinum→Gold, Gold→Silver, Silver→Bronze, Bronze stays Bronze, new player with no previous month
9. [ ] Write integration test — full points award → tier change → notification → lazy reset cycle end-to-end

**Acceptance criteria:**
- Player upgrades from Bronze to Silver at 500 monthly points
- Player upgrades from Silver to Gold at 2000 monthly points
- Player upgrades from Gold to Platinum at 10000 monthly points
- Tier upgrade creates a notification
- Milestone achievements (500, 1000, 2500, 5000, 10000) create notifications (no duplicates)
- Multiplier changes on tier upgrade are applied to subsequent awards (verified by test)
- Lazy month reset applies floor protection correctly
- Tier override expiry is enforced on read
- Tier-history record created on month reset

### Epic M1.3: Leaderboard
**Tracer bullet:** Seed multiple players with points → GET /leaderboard returns sorted top-N
**Depends on:** M1.1 (leaderboard entries written during points award)
**Parallelizable with:** M1.2, M1.4
**Data structures:** DS3
**Interfaces:** IF8
**Validation mode:** unit + integration
**Human checkpoint:** `curl /api/v1/leaderboard?limit=10` returns sorted results

**Tasks:**
1. [ ] Implement leaderboard service — query rewards-leaderboard by current monthKey, sort by monthlyPoints descending in-memory, return top N. Tie-breaking: players with equal points share the same rank; next rank skips (e.g., two players at rank 3 → next is rank 5).
2. [ ] Implement `GET /api/v1/leaderboard` route handler — accept `limit` query param (default 100, max 100), clamp invalid values
3. [ ] Write unit test for leaderboard sorting and tie-breaking logic
4. [ ] Write integration test — seed data, query, verify order

**Acceptance criteria:**
- Returns top N players sorted by monthly points descending
- Each entry has: rank, playerId, displayName, tier, monthlyPoints
- Tie-breaking: shared rank with gap (standard competition ranking)
- Default limit 100, respects `limit` query param, max 100
- Empty month returns empty array

### Epic M1.4: Notifications API
**Tracer bullet:** Tier upgrade creates notification → GET /notifications returns it with unread count
**Depends on:** M1.2 (notifications created by tier logic)
**Parallelizable with:** M1.3, M1.5
**Data structures:** DS4
**Interfaces:** IF9
**Validation mode:** integration
**Human checkpoint:** Trigger tier upgrade → GET notifications → see the notification

**Tasks:**
1. [ ] Implement notification service — create, query (all/unread), count unread, dismiss
2. [ ] Implement `GET /api/v1/player/notifications` route — accept `?unread=true`, return notifications + unreadCount
3. [ ] Implement `PATCH /api/v1/player/notifications/:notificationId/dismiss` route
4. [ ] Add notification routes to handler.js
5. [ ] Write integration test — create notification, query, dismiss, verify count

**Acceptance criteria:**
- GET returns player's notifications (optionally filtered to unread)
- Response includes unreadCount
- PATCH dismiss marks notification as dismissed
- 404 on dismiss of non-existent notification

### Epic M1.5: Admin Endpoints
**Tracer bullet:** GET /admin/players/:id/rewards returns full profile → POST /admin/points/adjust credits points
**Depends on:** M1.1 (needs working points engine for adjustments)
**Parallelizable with:** M1.3, M1.4
**Data structures:** DS1, DS2
**Interfaces:** IF10
**Validation mode:** integration
**Human checkpoint:** `curl /admin/players/player-001/rewards` returns data

**Tasks:**
1. [ ] Create `src/routes/admin.js` with all four admin endpoints
2. [ ] Implement GET /admin/players/:playerId/rewards — return full player profile
3. [ ] Implement POST /admin/points/adjust — manual credit/debit, write transaction with type `adjustment`, update player totals. Validate: debit cannot reduce monthlyPoints or lifetimePoints below 0.
4. [ ] Implement GET /admin/leaderboard — same as player leaderboard but include playerId and additional fields
5. [ ] Implement POST /admin/tier/override — set player tier with optional expiry, store in tierOverride field
6. [ ] Mount admin routes in handler.js (no auth middleware)
7. [ ] Write integration tests for admin adjust and override

**Acceptance criteria:**
- Admin can view any player's full rewards profile
- Admin can credit/debit points with a reason (creates adjustment transaction)
- Admin leaderboard shows player IDs
- Admin can override player tier with expiry
- No auth required on admin endpoints

### Epic M1.6: Player Dashboard (Web) — Core
**Tracer bullet:** Login with player ID → Dashboard shows tier card with real data → points history table populated
**Depends on:** M1.1 (API layer), M1.3 (leaderboard endpoint for widget), M1.4 (notifications endpoint for bell). Can start RTK Query setup and tier/history components once M1.1 is done; leaderboard widget and notification bell complete after M1.3/M1.4.
**Parallelizable with:** M1.5 (after M1.1 is complete)
**Data structures:** DS1, DS2
**Interfaces:** IF6, IF7
**Validation mode:** manual + component tests
**Human checkpoint:** Open http://localhost:4000, login, see dashboard with real data from API

**Tasks:**
1. [ ] Set up RTK Query API slice — define endpoints for player rewards, history, leaderboard, notifications
2. [ ] Implement player rewards endpoint: `GET /api/v1/player/rewards` route handler — return DS1 data shaped for frontend
3. [ ] Implement player history endpoint: `GET /api/v1/player/rewards/history` route handler — query DS2, return paginated
4. [ ] Build TierSummaryCard component — current tier, badge/icon, monthly points, points to next tier, progress bar
5. [ ] Build PointsHistoryTable component — table showing recent transactions with date, table, stakes, base/multiplied points
6. [ ] Build LeaderboardWidget component — top 10 + player's own rank (reuses leaderboard endpoint)
7. [ ] Build NotificationBell component — icon with unread count badge, dropdown with recent notifications
8. [ ] Integrate components into Dashboard page — layout with summary card, history, leaderboard, notification bell
9. [ ] Write component tests for TierSummaryCard and PointsHistoryTable with mock data

**Acceptance criteria:**
- Dashboard displays current tier with appropriate badge/color
- Progress bar shows monthly points vs next tier threshold
- Points history table shows recent transactions
- Leaderboard widget shows top 10
- Notification bell shows unread count
- Data comes from real API (not mocked in production)

## M2: Strong

### Epic M2.1: Bulk Monthly Reset Admin Endpoint
**Tracer bullet:** POST /admin/monthly-reset → all players reset in bulk → verify counts match → tier-history records created for all
**Depends on:** M1.2 (lazy reset logic already implemented)
**Parallelizable with:** M2.2, M2.3, M2.4
**Data structures:** DS1, DS4, DS5
**Interfaces:** IF12
**Validation mode:** integration
**Human checkpoint:** Trigger bulk reset via admin endpoint → verify all players reset → verify counts

**Tasks:**
1. [ ] Implement `POST /admin/monthly-reset` endpoint — scan all players, apply reset logic (reuses lazy reset from M1.2), return `{ playersReset, notifications }` count. Idempotent: skip players already on current monthKey.
2. [ ] Write integration test — seed multiple players across tiers, trigger bulk reset, verify all reset correctly

**Acceptance criteria:**
- Bulk reset processes all players
- Idempotent — safe to call multiple times
- Returns count of players reset and notifications created
- Reuses floor protection logic from M1.2

### Epic M2.2: Points History Pagination
**Tracer bullet:** Player with 50+ transactions → GET /history?limit=20&offset=0 returns first page → offset=20 returns second page
**Depends on:** M1.6 (basic history display)
**Parallelizable with:** M2.1, M2.3
**Data structures:** DS2
**Interfaces:** IF7
**Validation mode:** integration
**Human checkpoint:** Paginate through history in dashboard

**Tasks:**
1. [ ] Implement proper DynamoDB pagination with ExclusiveStartKey — translate offset to DynamoDB pagination token
2. [ ] Return total count (or hasMore flag) in response
3. [ ] Update frontend PointsHistoryTable to support pagination controls
4. [ ] Write integration test for pagination edge cases

**Acceptance criteria:**
- Pagination returns correct pages with limit/offset
- Frontend shows pagination controls
- Edge cases handled: empty results, last page with fewer items

### Epic M2.3: Leaderboard Self-Rank
**Tracer bullet:** Player outside top 100 → GET /leaderboard includes their rank
**Depends on:** M1.3 (basic leaderboard)
**Parallelizable with:** M2.1, M2.2
**Data structures:** DS3
**Interfaces:** IF8
**Validation mode:** integration
**Human checkpoint:** Login as a low-ranked player → see own rank in leaderboard widget

**Tasks:**
1. [ ] Implement self-rank calculation — if X-Player-Id header present, find player's position among all entries for current month
2. [ ] Include playerRank in leaderboard response when player not in top N
3. [ ] Update LeaderboardWidget to show "Your rank: #X" when applicable
4. [ ] Write integration test — player outside top 10 sees their rank

**Acceptance criteria:**
- Player sees their own rank even if outside the requested top N
- Self-rank appears as a separate field in the response
- Dashboard widget shows "Your rank: #X" below the top 10

### Epic M2.4: Notification Dismiss and Unread Count
**Tracer bullet:** Multiple notifications → dismiss one → unread count decrements → dismissed notification excluded from unread filter
**Depends on:** M1.4 (basic notifications)
**Parallelizable with:** M2.1, M2.2, M2.3
**Data structures:** DS4
**Interfaces:** IF9
**Validation mode:** integration
**Human checkpoint:** Trigger notifications → dismiss in dashboard → count updates

**Tasks:**
1. [ ] Verify dismiss endpoint works correctly (may already work from M1.4)
2. [ ] Implement frontend notification panel — list notifications, dismiss button, real-time unread count update
3. [ ] Write integration test for dismiss flow and count accuracy

**Acceptance criteria:**
- Dismiss marks notification as dismissed in DynamoDB
- Unread count excludes dismissed notifications
- Frontend updates count after dismiss

### Epic M2.5: Dashboard Tier Timeline + API Docs
**Tracer bullet:** Player with 6 months of tier history → dashboard shows visual tier timeline → API docs cover all endpoints
**Depends on:** M1.2 (tier-history data created by lazy reset)
**Parallelizable with:** M2.2, M2.3, M2.4
**Data structures:** DS5
**Interfaces:** None new
**Validation mode:** manual + component test
**Human checkpoint:** Dashboard shows tier progression chart for last 6 months; API docs viewable

**Tasks:**
1. [ ] Implement `GET /api/v1/player/tier-history` endpoint — query DS5 for last 6 months
2. [ ] Build TierTimeline component — visual chart showing tier level per month (simple bar or step chart using MUI or inline SVG)
3. [ ] Seed tier-history data for testing
4. [ ] Write component test for TierTimeline
5. [ ] Write API documentation — markdown spec with all endpoint definitions, request/response shapes, error codes
6. [ ] Write integration tests for points award flow end-to-end

**Acceptance criteria:**
- Tier timeline shows last 6 months of tier progression
- Timeline is visually clear (bar chart, step chart, or similar)
- API documentation covers all REST endpoints
- Integration tests cover points award → tier change → notification flow

## Dependency Graph

```
M1.0 (Scaffold)
  │
  └── M1.1 (Points Engine) ──┬── M1.2 (Tier + Lazy Reset) ──┬── M1.4 (Notifications) ── M2.4
      │                       │                                │
      │                       ├── M1.3 (Leaderboard) ───────── M2.3
      │                       │
      │                       └── M1.5 (Admin) ─── M2.1 (Bulk Reset)
      │
      └── M1.6 (Dashboard Core) ──┬── M2.2 (Pagination)
                                   └── M2.5 (Timeline + Docs)
```

**Spine (critical path):** M1.0 → M1.1 → M1.2 → M1.6 → M2.5

**Parallel branches after M1.1:**
- M1.3 (leaderboard), M1.4 (notifications), M1.5 (admin) can proceed in parallel
- M1.6 (dashboard) can start RTK Query and core components once M1.1 is done; completes after M1.3/M1.4

**M2 parallel branches after M1 complete:**
- M2.1, M2.2, M2.3, M2.4 are all independent of each other
- M2.5 depends on M1.2 (tier-history data already created by lazy reset in M1.2)

## Validation Map

| Checkpoint | Validates | Type |
|------------|-----------|------|
| Docker Compose up + seed | M1.0 | Manual |
| `npm test` passes | M1.0, M1.1, M1.2 | Automated |
| POST /points/award returns correct points | M1.1 | Integration test |
| Tier upgrades on threshold | M1.2 | Unit + integration test |
| Leaderboard sorted correctly | M1.3 | Integration test |
| Notifications created and queryable | M1.4 | Integration test |
| Admin adjust credits points | M1.5 | Integration test |
| Dashboard shows real data | M1.6 | Manual |
| Monthly reset with floor protection | M2.1 | Unit + integration test |
| History pagination | M2.2 | Integration test |
| Self-rank in leaderboard | M2.3 | Integration test |
| Notification dismiss + count | M2.4 | Integration test |
| Tier timeline renders | M2.5 | Component test + manual |
| API docs complete | M2.5 | Manual review |

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DynamoDB Local quirks (GSI behavior differs from production) | MEDIUM | MEDIUM | Test with actual queries early in M1.0; document any workarounds |
| Leaderboard sort performance with large datasets | LOW | LOW | In-memory sort for top-100 is fine at 50-100 players; document that production would need a GSI |
| Monthly reset race conditions (lazy + bulk) | MEDIUM | LOW | Use conditional updates with monthKey check to prevent double-reset |
| Frontend complexity of tier timeline | LOW | MEDIUM | Keep it simple — MUI stepper or basic bar chart, not a full charting library |
| Seed script / test data mismatch with actual flow | MEDIUM | MEDIUM | Build seed script early (M1.0) and verify it matches what the points engine produces |
| Serverless-offline version compatibility | LOW | LOW | Pin versions in package.json; test early |

## Open Questions for Human Review

None — all blocking questions resolved in human-clarify gate.
