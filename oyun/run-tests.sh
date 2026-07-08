#!/usr/bin/env sh
set -eu
find . -name '*.js' -not -path './tests/*' -print | while read -r f; do node --check "$f"; done
node tests/smoke-core.js
node tests/profile-reset.js
node tests/u1-foundation.js
node tests/u2-first-orbit.js
node tests/warfront-maintenance.js
node tests/stability-fuzz.js
node tests/data-integrity.js
node tests/dom-contract.js
node tests/u3-background-save-brand.js
node tests/u3-1-save-recovery-accessibility.js
node tests/u3-capacity-defense.js
node tests/u4-indexeddb-durability.js
node tests/u4-1-idempotent-commands.js
node tests/u4-1-server-time.js
node tests/u4-2-authoritative-server.js
node tests/u4-2-http-concurrency.js
node tests/u4-2-reconciliation-coverage.js

node tests/u4-3-sqlite-persistence.js
node tests/u4-3-process-restart-http.js
node tests/u4-3-sqlite-concurrency.js
node tests/u4-3-network-adapter.js
node tests/u4-3-signed-flow-save.js

node tests/u4-3-1-groundfront-reset.js
node tests/u4-3-1-authoritative-reset.js
node tests/u4-3-2-power-input.js

# P0 — gerçek uzaysal Factorio çekirdeği (dikey dilim)
node tests/p0-spatial-sim.js
