# Bead Manifest: rewards-generic-v2

## Total Beads: 14 (2 milestones + 12 feature epics)

## Milestone Epics
| ID | Title | Status |
|----|-------|--------|
| p4-j1l | M1: Minimum / Pass | blocked (7 children) |
| p4-p3v | M2: Strong | blocked (5 children + M1) |

## M1 Feature Epics
| ID | Title | Priority | Blocked By |
|----|-------|----------|------------|
| p4-mpd | M1.0: Scaffold and Data Model Foundation | P1 | (ready) |
| p4-rdd | M1.1: Points Engine (Core Business Logic) | P0 | M1.0 |
| p4-cw3 | M1.2: Tier Progression + Lazy Month Reset | P0 | M1.1 |
| p4-8ro | M1.3: Leaderboard | P1 | M1.1 |
| p4-dkt | M1.4: Notifications API | P1 | M1.2 |
| p4-hls | M1.5: Admin Endpoints | P1 | M1.1 |
| p4-2ts | M1.6: Player Dashboard (Web) — Core | P1 | M1.1, M1.3, M1.4 |

## M2 Feature Epics
| ID | Title | Priority | Blocked By |
|----|-------|----------|------------|
| p4-rer | M2.1: Bulk Monthly Reset Admin Endpoint | P2 | M1.2 |
| p4-zmm | M2.2: Points History Pagination | P2 | M1.6 |
| p4-rng | M2.3: Leaderboard Self-Rank | P2 | M1.3 |
| p4-0kj | M2.4: Notification Dismiss and Unread Count | P2 | M1.4 |
| p4-dhv | M2.5: Dashboard Tier Timeline + API Docs | P2 | M1.2 |

## Ready to Start
- p4-mpd (M1.0: Scaffold and Data Model Foundation)

## Dependency Chain
```
p4-mpd (M1.0) ─→ p4-rdd (M1.1) ─┬→ p4-cw3 (M1.2) ─┬→ p4-dkt (M1.4) ──→ p4-0kj (M2.4)
                                   │                   ├→ p4-rer (M2.1)
                                   │                   └→ p4-dhv (M2.5)
                                   ├→ p4-8ro (M1.3) ──→ p4-rng (M2.3)
                                   ├→ p4-hls (M1.5)
                                   └→ p4-2ts (M1.6) ──→ p4-zmm (M2.2)
                                       (also needs M1.3, M1.4)
```

## Execution Plan
```bash
gt sling p4-mpd poker_rewards_generic2   # Start with scaffold
```
