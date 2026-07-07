# Axyon Idle Factory v4.4 U1 — Integration Report

**Version:** 4.4.0-u1  
**Stage:** U1 — Save v16 & Canonical Data Foundation  
**Playable mechanics:** Warfront Command v4.3 compatibility gameplay  
**Target design:** First Orbit & Dominion v4.4

## Net result

U1 integration passed. The playable v4.3 base now stores profiles as save schema v16, migrates v15 losslessly with immutable backup and rollback, loads the frozen v4.4 canonical data, and exposes the `break_eternity.js` EconomyNumber adapter.

The full economy tick still runs in numeric compatibility mode. Zero-credit First Orbit gameplay and Decimal-native production are intentionally deferred to U2.

## Implemented

- `break_eternity.js@2.1.3` vendor integration
- Central `Axyon.EconomyNumber` adapter
- Browser/Node lossless JSON parser
- Browser/Node v15 → v16 migrator
- SHA-256 migration backup
- Temporary commit + validation + rollback
- Corrupt-save autosave block
- v16 profile create/save/load/reset/export/import
- Frozen v4.4 canonical data loader and read-only ID indexes
- Service worker and PWA manifest update
- Removal of leaked `economy.js.pre430`
- U1 feature flags and diagnostics

## Feature flags

```text
V44_SAVE_V16_ENABLED=true
V44_CANONICAL_DATA_ENABLED=true
V44_ZERO_CREDIT_GAMEPLAY_ENABLED=false
V44_DECIMAL_RUNTIME_ENABLED=false
```

## Node regression results

```text
PASS smoke-core: map, automation, market, upgrades, galaxy, resurgence, colonization, raids, migration, timed research, Mk V, offline safety, quests
PASS profile-reset: isolated local profiles, switching, deletion, corrupt-import sanitization and full reset
PASS u1-foundation: canonical loader, SHA-256, v16 storage, exact unsafe migration shadow, rollback block, reset recovery and export/import
PASS warfront-maintenance: automation V, bounded manual click, repair reservation/parallelism, detailed combat, cargo-limited salvage, raids, frontier scaling and v15 migration
PASS stability-fuzz: 12,000 deterministic economy/combat/repair cycles, numeric invariants, queues and save roundtrip
PASS data-integrity: technology, recipes, multi-year research horizon, documentation and encyclopedia references
PASS dom-contract: static ids, help keys, responsive UI contracts, combat page, script order and local assets
```

## Browser smoke results

- Console/page errors: 0
- New profile stored as v16: True
- Economy values stored as strings: True
- Reload persistence: True
- Unsafe integer exact storage preserved: 9007199254740993123456789
- Immutable migration backup count: 1
- Corrupt original preserved: True
- Autosave blocked after corrupt migration: True
- Reset recovery returned valid v16: True
- Horizontal document overflow: False

## Canonical data loaded

| Group | Count |
|---|---:|
| items | 52 |
| machines | 50 |
| powerPlants | 5 |
| technologies | 52 |
| repeatableTechnologies | 12 |
| ships | 10 |
| satellites | 3 |
| defenses | 8 |
| planetTypes | 4 |

## Important limitation

An unsafe manually edited v15 integer larger than `Number.MAX_SAFE_INTEGER` is kept exactly in v16 storage. U1’s existing gameplay runtime displays a safe clamped value because the old economy core still uses JavaScript Number. If the value is not changed, the exact shadow string is preserved on subsequent saves. Decimal-native gameplay operations are the U2 acceptance gate.

## Rollback

- Set `V44_SAVE_V16_ENABLED=false` to disable v16 storage in a development build.
- Every v15 migration creates a `.backup.v15.<sha-prefix>` localStorage entry before commit.
- Failed migration never overwrites the active raw save.
- Corrupt migration suspends autosave until reset/import recovery.

## Verification boundary

Passed:

- Static syntax
- Existing production/gameplay regressions
- 12,000-cycle deterministic fuzz
- v16 save round-trip
- Unsafe integer migration
- Truncated save rollback
- Browser onboarding/profile/save/reload/migration/reset smoke
- Canonical data counts and duplicate-ID validation
- DOM/PWA asset contracts

Not yet claimed:

- Decimal-native economy tick
- Zero-credit start
- Mk 0 satellite gameplay
- v4.4 production recipes in the live game
- Real multiplayer server authority

## Next work

**U2 — Decimal Runtime & First Orbit Economy Bridge**

Convert credits, inventory, flow, market revenues, production totals and cost comparisons to EconomyNumber; then activate the zero-credit First Orbit start and Mk 0 satellite chain behind a separate gameplay flag.
