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
