#!/usr/bin/env sh
set -eu
./run-tests.sh
python3 tests/u3-browser-smoke.py
python3 tests/u4-browser-smoke.py
python3 tests/u4-1-browser-smoke.py
