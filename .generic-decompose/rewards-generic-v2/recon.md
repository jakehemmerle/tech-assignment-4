# Reconnaissance Report: rewards-generic-v2

## Source Corpus

| Document | Contributes |
|----------|------------|
| `docs/challenge-rewards.md` | Primary challenge spec — functional requirements (FR-1 through FR-6), technical requirements, suggested architecture, DynamoDB data model, acceptance criteria (must/should/could have), out-of-scope items |
| `README.md` | Repo overview — Docker Compose profiles, architecture diagram, project structure, quick start, running tests, port reference |
| `docs/README.md` | Higher-level context — evaluation criteria (30% working software, 25% code quality, 20% testing, 15% architecture, 10% docs), platform architecture overview, submission requirements |
| `docs/local-development.md` | Local dev guide — service ports, how to start/stop, code change workflow, test execution, shared code patterns |
| `AGENTS.md` | Lists all four source docs above as the corpus for this decomposition |

## Project Summary

**Problem:** Build a loyalty rewards system for a poker platform where players earn points from gameplay, progress through tiers (Bronze → Silver → Gold → Platinum), and view their status on a web dashboard. The system has three surfaces: a backend API, a React web dashboard, and REST endpoints for a Unity mobile client.

**Goals:**
- Points engine with stakes-based calculation and tier multipliers
- Tier progression with monthly resets and one-tier-drop floor protection
- Immutable points ledger (append-only transactions)
- Monthly leaderboard (top 100 + self-rank)
- Web dashboard showing tier status, points history, tier timeline, leaderboard widget
- Notifications on tier changes and milestones
- Admin endpoints for player management and manual adjustments
- REST API contract for Unity client consumption
- Comprehensive test coverage on business logic

**Non-Goals (explicitly out of scope):**
- User registration / authentication system (stub JWT guard only)
- Email or push notification delivery
- Integration with actual game engine
- Unity client implementation
- Payment or real-money transactions
- Backoffice UI for admin endpoints
- Production deployment / infrastructure provisioning

## Existing Context

### Repo State
- **Skeleton repo** with Docker Compose profiles for `rewards`, `engine`, `streaks`
- All core infra provided: MySQL 8.0, Redis 7, DynamoDB Local
- Backend: Express.js wrapped in serverless-http (NOT NestJS — challenge spec says NestJS but skeleton uses Express/serverless-offline)
- Frontend: React 18 + MUI 5 + Redux Toolkit + Vite + TypeScript
- Shared code at `serverless-v2/shared/` (dynamo.js, logger.js, db.js, redis.js)

### Existing Skeleton Code (rewards-specific)

**Backend (`serverless-v2/services/rewards-api/`):**
- `handler.js` — Express app with route mounting, CORS, auth middleware
- `src/middleware/auth.js` — Stub auth extracting `X-Player-Id` header
- `src/routes/health.js` — Working health endpoint
- `src/routes/points.js` — Stub: `POST /award` and `GET /leaderboard` (return 501)
- `src/routes/player.js` — Stub: `GET /rewards` and `GET /history` (return 501)
- `src/services/dynamo.service.js` — CRUD helpers: getPlayer, putPlayer, updatePlayer, addTransaction, getTransactions, getAllPlayers
- `src/config/constants.js` — Tier definitions (Bronze/Silver/Gold/Platinum with thresholds and multipliers), point rules, getTierForPoints, getNextTier
- `serverless.offline.yml` — Serverless Framework v3 config for local dev (port 5000)
- `package.json` — Express, AWS SDK v3, serverless-http, Jest

**Frontend (`serverless-v2/services/rewards-frontend/`):**
- Vite + React 18 + TypeScript + MUI + Redux Toolkit
- `src/App.tsx` — Router with Dashboard and Login routes
- `src/pages/Login.tsx` — Player ID input (stub auth via localStorage)
- `src/pages/Dashboard.tsx` — Placeholder "build your UI here"
- `src/store.ts` — Redux store with auth slice (login/logout)
- `src/api/client.ts` — Axios client with X-Player-Id interceptor

**Seed/Init:**
- `scripts/seed-rewards.js` — Seeds 50 players with random points and 5-15 transactions each
- `scripts/init-dynamodb.sh` — Creates all DynamoDB tables (run by dynamodb-init container)
- Docker Compose creates tables on startup: rewards-players, rewards-transactions, rewards-leaderboard, rewards-notifications

**Tests:**
- 1 existing test: health endpoint check (`__tests__/health.test.js`)
- Jest configured with `--experimental-vm-modules`

### Architecture and Naming Conventions
- Express routes in `src/routes/` with Router pattern
- Services in `src/services/` (DynamoDB operations)
- Config in `src/config/`
- Middleware in `src/middleware/`
- CommonJS (`require`/`module.exports`) in backend
- ESM + TypeScript in frontend
- DynamoDB tables prefixed with `rewards-`

### Key Divergence from Challenge Spec
The challenge spec says "NestJS" but the skeleton provides **Express.js with serverless-offline**. The constants.js file has different point rules than the spec (the spec says stakes-based points per hand; the skeleton has generic HAND_PLAYED/HAND_WON etc.). **The spec's data model and point calculation rules should take precedence** — the skeleton constants are just stubs to be replaced.

## Development and Validation Environment

**Start:**
```bash
cp .env.example .env
docker compose --profile rewards up
```

**Services:**
| Service | Port | URL |
|---------|------|-----|
| Rewards API | 5000 | http://localhost:5000/api/v1/health |
| Rewards Frontend | 4000 | http://localhost:4000 |
| DynamoDB Local | 8000 | http://localhost:8000 |
| MySQL | 3306 | mysql -uhijack -phijack_dev hijack_poker |
| Redis | 6379 | redis-cli |

**Run tests:**
```bash
cd serverless-v2/services/rewards-api && npm install && npm test
```

**Seed data:**
```bash
node scripts/seed-rewards.js
```

**Code changes:** Volume-mounted but serverless-offline doesn't hot-reload. Restart: `docker compose restart rewards-api`

**CI:** GitHub Actions runs `npm test` for rewards-api (and other services).

## Key Constraints

1. **Stack:** Node.js 22, Express (via serverless-http), DynamoDB (AWS SDK v3), React 18 + TypeScript + MUI + Redux Toolkit
2. **Database:** DynamoDB only for rewards data (tables already defined in Docker Compose init)
3. **Auth:** Stub JWT — use X-Player-Id header (already implemented)
4. **Testing:** Jest for backend, React Testing Library for frontend
5. **Local dev:** Docker Compose with serverless-offline, DynamoDB Local
6. **Time scope:** ~30 hours of focused work (the original challenge scope)
7. **Evaluation weights:** 30% working software, 25% code quality, 20% testing, 15% architecture, 10% docs
8. **Points calculation:** Stakes-based per hand (spec), NOT the generic rules in the skeleton constants
9. **No NestJS migration** — build on the existing Express skeleton to maximize time on business logic

## Likely Validation Surfaces

1. **Unit tests (Jest):** Points calculation logic, tier progression, monthly reset, multiplier application, stakes-to-points mapping
2. **Integration tests (Jest + DynamoDB Local):** Points award flow end-to-end (API → DynamoDB → response), leaderboard queries, transaction history pagination
3. **API contract tests:** Request/response shape validation for all REST endpoints (player, admin, Unity)
4. **Frontend component tests (React Testing Library):** Dashboard rendering with mock data, tier display, progress bar, leaderboard widget
5. **Manual checkpoints:**
   - `docker compose --profile rewards up` → services healthy
   - Seed data → dashboard shows real data
   - Award points → tier upgrades → notification created
   - Leaderboard shows correct rankings
   - Admin endpoints return enriched data
6. **E2E (optional):** Full flow from points award through tier change through dashboard display

## Unknowns and Risks

1. **NestJS vs Express:** Spec says NestJS but skeleton is Express. Decision: **stay with Express** — migrating to NestJS is pure overhead with no business value for this challenge. The spec says "you may deviate."
2. **DynamoDB GSI for leaderboard sorting:** The rewards-leaderboard table has monthKey (PK) + playerId (SK), but sorting by monthlyPoints requires a GSI. The init script doesn't create one. Need to either add a GSI or sort in-memory (acceptable for top-100).
3. **Monthly reset mechanism:** Spec says "monthly tier reset" but doesn't require cron — "even if triggered manually" is acceptable for "should have." Need to decide: scheduled endpoint, manual trigger, or both.
4. **Transaction table GSI:** The spec defines a monthKey GSI-PK + createdAt GSI-SK for monthly queries, but the Docker init script doesn't create this GSI. Need to add it or query differently.
5. **Seed script mismatch:** The existing seed script doesn't match the spec's data model (missing monthlyPoints, lifetimePoints, tierFloor, etc.). Seed script needs rewriting.
6. **Frontend scope:** Dashboard needs summary card, points history table, tier timeline (6 months), and leaderboard widget. MUI provides good building blocks, but the tier timeline is the most complex UI component.
7. **Notification storage:** Table exists but no routes or service code for notifications yet. Needs full implementation.
8. **Admin endpoints:** No routes or middleware for admin. Need admin auth guard (or just check for admin header).
