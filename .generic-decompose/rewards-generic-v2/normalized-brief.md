# Normalized Brief: rewards-generic-v2

## Problem Summary

Build a poker loyalty rewards system on an existing Express/serverless skeleton. Players earn points from cash game hands (scaled by table stakes and tier multiplier), progress through four tiers within monthly rolling windows, and view their status on a React dashboard. The system serves three consumers: a web dashboard, REST endpoints for a Unity mobile client, and admin back-office endpoints.

## Goals

1. Implement a points engine that awards points per hand based on table stakes, applies tier multipliers, and maintains an immutable ledger
2. Implement tier progression (Bronze → Silver → Gold → Platinum) with immediate upgrades, monthly resets, and one-tier-drop floor protection
3. Build a monthly leaderboard showing top 100 players with self-rank lookup
4. Build a React dashboard showing tier status, points history, tier timeline, and leaderboard
5. Implement notification creation on tier changes and milestone achievements
6. Expose REST endpoints for Unity client consumption
7. Expose admin endpoints for player management and manual adjustments
8. Achieve strong test coverage on business logic (points calculation, tier progression)
9. Ensure Docker Compose starts all dependencies and `npm test` passes

## Non-Goals

- User registration or full authentication system (stub JWT guard only)
- Email or push notification delivery (store-and-retrieve only)
- Integration with actual game engine or processor
- Unity client implementation
- Payment or real-money transactions
- Backoffice UI for admin endpoints
- Production deployment or infrastructure provisioning
- Migration to NestJS (challenge spec suggests it, but skeleton is Express — staying with Express per "you may deviate")

## Constraints

### Hard Constraints
- **Runtime:** Node.js 22, Express.js (via serverless-http), serverless-offline for local dev
- **Database:** DynamoDB via AWS SDK v3 (DynamoDB Local in Docker)
- **Frontend:** React 18+ with TypeScript, Redux Toolkit (RTK Query preferred), MUI
- **Testing:** Jest for backend, React Testing Library for frontend components
- **Auth:** Stub — `X-Player-Id` header extraction (already implemented)
- **Infrastructure:** Docker Compose `--profile rewards` must start everything
- **Points ledger:** Immutable, append-only. Store individual transactions, not running balances.
- **Tier multiplier:** Applied at time of earning, stored on the transaction record

### Preferences
- `class-validator` + `class-transformer` for DTOs (spec says this but Express doesn't natively support it — use manual validation or a lightweight alternative)
- RTK Query for API calls in frontend (preferred over raw axios)
- API response shapes documented (OpenAPI, TypeDoc, or markdown spec)
- Meaningful commit history

## Required Capabilities

### RC-1: Points Engine
- Award points per hand based on big blind amount:
  - $0.10–$0.25 BB → 1 base point
  - $0.50–$1.00 BB → 2 base points
  - $2.00–$5.00 BB → 5 base points
  - $10.00+ BB → 10 base points
- Apply player's current tier multiplier: `earned = base × multiplier`
- Only award for hands where player was dealt cards (not sitting out)
- Track monthly points (for tier progression) and lifetime points (for display)
- Immutable ledger — every transaction is a new record

### RC-2: Tier System
- Four tiers: Bronze (0pts, 1.0x), Silver (500pts, 1.25x), Gold (2000pts, 1.5x), Platinum (10000pts, 2.0x)
- Upgrades happen immediately when monthly threshold is reached
- Monthly reset on 1st of month at 00:00 UTC
- Floor protection: highest tier in previous month → cannot drop more than one tier (e.g., Platinum resets to at least Gold)
- Tier changes trigger notification creation

### RC-3: Leaderboard
- Top 100 players by monthly points
- Each entry: rank, display name, tier, monthly points
- Player can see their own rank even if outside top 100
- Refreshes on read (no caching required; bonus if added)

### RC-4: Player Dashboard (Web)
- Summary card: current tier, tier badge, monthly points, points to next tier, progress bar
- Points history: table with recent transactions (date, table, stakes, base points, multiplier, earned points)
- Tier timeline: visual showing tier progression across last 6 months
- Leaderboard widget: top 10 + player's own rank

### RC-5: Notifications
- Create notification on: tier upgrade, tier downgrade (monthly reset), milestone achievements (define 3-5 milestones, e.g., 500pts, 1000pts, 2500pts, 5000pts, 10000pts)
- Stored and retrievable via API
- Dashboard shows notification bell with unread count
- Actual push delivery is out of scope

### RC-6: Admin Endpoints
- `GET /admin/players/:playerId/rewards` — Full rewards profile
- `POST /admin/points/adjust` — Manual credit/debit with reason
- `GET /admin/leaderboard` — Enhanced leaderboard with player ID and email
- `POST /admin/tier/override` — Manual tier set with expiry

### RC-7: Unity Client REST Endpoints
- `GET /api/v1/player/rewards` — Current tier, points, progress
- `GET /api/v1/player/rewards/history?limit=20&offset=0` — Points history
- `GET /api/v1/leaderboard?limit=10` — Leaderboard
- `GET /api/v1/player/notifications?unread=true` — Player notifications
- `PATCH /api/v1/player/notifications/:id/dismiss` — Dismiss notification
- Must be documented with request/response schemas

### RC-8: Seed Script
- Generate sample point transactions for testing dashboard and leaderboard
- Must populate all DynamoDB tables with realistic data matching the actual data model

## Acceptance Criteria by Tier

### M1 (Minimum / Pass)
- [ ] Points awarded correctly based on table stakes and tier multiplier
- [ ] Tier progression works — player upgrades when monthly threshold is reached
- [ ] Points ledger is immutable (append-only)
- [ ] Leaderboard returns top players sorted by monthly points
- [ ] Dashboard displays current tier, points, progress to next tier
- [ ] Dashboard displays points transaction history
- [ ] Notification created on tier change
- [ ] REST endpoints for Unity client return correct data shapes
- [ ] Admin can view a player's rewards profile
- [ ] Admin can manually adjust points
- [ ] Unit tests cover points calculation and tier progression logic
- [ ] Docker Compose starts all dependencies, `npm test` passes

### M2 (Strong)
- [ ] Points history pagination works correctly
- [ ] Leaderboard shows player's own rank (even if outside top 100)
- [ ] Notification dismiss works, unread count is correct
- [ ] Monthly tier reset logic is implemented (even if triggered manually)
- [ ] Dashboard has a tier timeline showing last 6 months
- [ ] Integration tests on at least the points award flow
- [ ] API response shapes are documented (OpenAPI, TypeDoc, or markdown spec)

## Architecture Guardrails

1. **Stay on Express** — Do not migrate to NestJS. The skeleton provides a working Express setup. The spec says "you may deviate."
2. **Module structure** — Follow existing pattern: `src/routes/`, `src/services/`, `src/config/`, `src/middleware/`
3. **DynamoDB tables** — Use the four tables defined in Docker init: `rewards-players`, `rewards-transactions`, `rewards-leaderboard`, `rewards-notifications`
4. **Data model** — Follow the spec's DynamoDB schema for field names and types. The existing skeleton dynamo.service.js and constants.js are stubs that need updating.
5. **Frontend state** — Use Redux Toolkit, preferably RTK Query for API layer
6. **Testing** — Jest for backend (unit + integration), React Testing Library for frontend
7. **No over-engineering** — This is a 30-hour challenge. Focus on correctness and completeness over polish. Skip Redis caching, WebSockets, rate limiting unless core work is done.

## Data Structures to Define

### DS1: PlayerRewardsProfile
- Exact structure name: `rewards-players` DynamoDB item
- Purpose: Store player's current rewards state
- Attributes:
  - `playerId: String (PK)` — Player GUID
  - `displayName: String` — Player display name
  - `currentTier: Number (1-4)` — Current tier level
  - `monthlyPoints: Number` — Points earned in current calendar month
  - `lifetimePoints: Number` — All-time point total
  - `tierFloor: Number (1-4)` — Minimum tier from previous month's protection
  - `lastTierChangeAt: String (ISO)` — When tier last changed
  - `monthKey: String` — Current month key (YYYY-MM) for tracking reset boundary
  - `createdAt: String (ISO)` — Player creation timestamp
  - `updatedAt: String (ISO)` — Last update timestamp
- Invariants: monthlyPoints >= 0, lifetimePoints >= monthlyPoints, currentTier >= tierFloor, tierFloor >= max(1, previousMonthTier - 1)

### DS2: PointsTransaction
- Exact structure name: `rewards-transactions` DynamoDB item
- Purpose: Immutable ledger of all point transactions
- Attributes:
  - `playerId: String (PK)` — Player GUID
  - `timestamp: Number (SK)` — Epoch milliseconds
  - `type: String` — `gameplay` | `adjustment` | `bonus`
  - `basePoints: Number` — Pre-multiplier points
  - `multiplier: Number` — Tier multiplier at time of earn
  - `earnedPoints: Number` — basePoints × multiplier
  - `tableId: Number | null` — Game table ID (null for adjustments)
  - `tableStakes: String | null` — e.g., "2/5"
  - `handId: String | null` — For dedup (bonus feature)
  - `monthKey: String` — YYYY-MM for monthly queries
  - `reason: String | null` — For manual adjustments
  - `createdAt: String (ISO)` — ISO timestamp
- Invariants: earnedPoints = basePoints × multiplier, timestamp is unique per player (epoch ms)

### DS3: LeaderboardEntry
- Exact structure name: `rewards-leaderboard` DynamoDB item
- Purpose: Monthly leaderboard for ranking players
- Attributes:
  - `monthKey: String (PK)` — YYYY-MM
  - `playerId: String (SK)` — Player GUID
  - `displayName: String` — Player display name
  - `tier: Number (1-4)` — Current tier
  - `monthlyPoints: Number` — Monthly point total (sort key for ranking)
- Invariants: One entry per player per month

### DS4: Notification
- Exact structure name: `rewards-notifications` DynamoDB item
- Purpose: Player notification records
- Attributes:
  - `playerId: String (PK)` — Player GUID
  - `notificationId: String (SK)` — ULID or UUID
  - `type: String` — `tier_upgrade` | `tier_downgrade` | `milestone`
  - `title: String` — Display title
  - `description: String` — Display body
  - `dismissed: Boolean` — Has player dismissed it
  - `createdAt: String (ISO)` — ISO timestamp
- Invariants: notificationId is unique, dismissed defaults to false

## Core Interfaces / Contracts to Define

### IF1: Points Award Endpoint
- Type: REST API
- Exact function signatures:
  - `POST /api/v1/points/award`
  - Request body: `{ playerId: string, tableId: number, tableStakes: string, bigBlind: number, handId: string }`
  - Response: `{ playerId: string, transaction: PointsTransaction, player: { currentTier: number, monthlyPoints: number, lifetimePoints: number } }`
- Behavioral constraints: Calculates base points from bigBlind, applies tier multiplier, writes transaction, updates player totals, checks tier advancement, creates notification if tier changes
- Error conditions: 400 if missing required fields, 404 if player not found (or auto-create)

### IF2: Player Rewards Endpoint
- Type: REST API
- Exact function signatures:
  - `GET /api/v1/player/rewards`
  - Headers: `X-Player-Id: string`
  - Response: `{ playerId: string, currentTier: number, tierName: string, monthlyPoints: number, lifetimePoints: number, pointsToNextTier: number | null, nextTierName: string | null, multiplier: number, tierFloor: number }`
- Behavioral constraints: Returns current state from rewards-players table
- Error conditions: 401 if no X-Player-Id, 404 if player not found

### IF3: Points History Endpoint
- Type: REST API
- Exact function signatures:
  - `GET /api/v1/player/rewards/history?limit=20&offset=0`
  - Headers: `X-Player-Id: string`
  - Response: `{ transactions: PointsTransaction[], total: number, limit: number, offset: number }`
- Behavioral constraints: Returns transactions sorted by timestamp descending, paginated
- Error conditions: 401 if no X-Player-Id

### IF4: Leaderboard Endpoint
- Type: REST API
- Exact function signatures:
  - `GET /api/v1/leaderboard?limit=10`
  - Response: `{ leaderboard: Array<{ rank: number, playerId: string, displayName: string, tier: number, monthlyPoints: number }>, playerRank?: { rank: number, playerId: string, displayName: string, tier: number, monthlyPoints: number } }`
- Behavioral constraints: Returns top N by monthly points for current month. If X-Player-Id header present, includes player's own rank.
- Error conditions: None (returns empty array if no data)

### IF5: Notifications Endpoint
- Type: REST API
- Exact function signatures:
  - `GET /api/v1/player/notifications?unread=true`
  - `PATCH /api/v1/player/notifications/:notificationId/dismiss`
- Behavioral constraints: GET returns notifications (optionally filtered by unread). PATCH marks as dismissed.
- Error conditions: 401 if no X-Player-Id, 404 if notification not found

### IF6: Admin Endpoints
- Type: REST API
- Exact function signatures:
  - `GET /admin/players/:playerId/rewards` → Full player profile
  - `POST /admin/points/adjust` body: `{ playerId: string, points: number, reason: string }` → Adjusted player state
  - `GET /admin/leaderboard` → Enhanced leaderboard with playerId and email
  - `POST /admin/tier/override` body: `{ playerId: string, tier: number, expiresAt: string }` → Overridden player state
- Behavioral constraints: Admin endpoints don't require player auth. Could use a separate admin header/key or no auth (spec doesn't specify).
- Error conditions: 400 for invalid input, 404 for unknown player

### IF7: Monthly Reset
- Type: Internal service function (optionally exposed as endpoint)
- Exact function signatures:
  - `resetMonthlyTiers(): Promise<{ playersReset: number, notifications: number }>`
  - For each player: calculate new tier floor, reset monthlyPoints to 0, set currentTier to max(tierFloor, 1), create tier_downgrade notification if tier dropped
- Behavioral constraints: Idempotent per month. Only runs if current monthKey differs from player's stored monthKey.
- Error conditions: Should handle partial failures gracefully

### IF8: Points Calculation
- Type: Internal service function
- Exact function signatures:
  - `calculateBasePoints(bigBlind: number): number` — Maps BB to base points per stakes table
  - `calculateEarnedPoints(basePoints: number, multiplier: number): number` — Returns Math.floor(basePoints * multiplier)
  - `getTierForPoints(monthlyPoints: number): { tier: number, name: string, multiplier: number }`
  - `getNextTier(currentTier: number): { tier: number, name: string, threshold: number } | null`
- Behavioral constraints: Pure functions, no side effects
- Error conditions: Invalid bigBlind defaults to lowest tier (1 base point)

## Validation Strategy

1. **Unit tests** on pure business logic: points calculation, tier determination, multiplier application, monthly reset logic, stakes-to-points mapping
2. **Integration tests** using DynamoDB Local: points award flow (API call → DB write → correct response), leaderboard query, notification creation on tier change
3. **API contract tests**: Validate request/response shapes match documented specs
4. **Frontend component tests**: Dashboard renders tier card, history table, leaderboard widget with mock data
5. **Manual validation**: Docker Compose up → seed → dashboard shows data → award points → tier upgrades → notification appears
6. **CI**: GitHub Actions runs `npm test` for rewards-api

## Clarifications from Human Review

**Q: Player auto-creation on points award for unknown player?**
A: Auto-create a Bronze player. Game processor shouldn't need to pre-register.

**Q: Admin endpoint auth?**
A: Open (no auth guard). Spec says "backend-only endpoints, no UI required."

**Q: Leaderboard update strategy?**
A: Update on write — write to rewards-leaderboard table on each points award.

**Q: Monthly reset trigger?**
A: Manual endpoint + lazy check on player read (if monthKey is stale, auto-reset).

**Q: Tier timeline historical data?**
A: Store a tier-history record per month per player for simplicity.
