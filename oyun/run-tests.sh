#!/usr/bin/env sh
set -eu
find . -name '*.js' -not -path './tests/*' -print | while read -r f; do node --check "$f"; done
node tests/smoke-core.js
