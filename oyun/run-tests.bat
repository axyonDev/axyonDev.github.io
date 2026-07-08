@echo off
setlocal
for /r %%F in (*.js) do node --check "%%F" || goto :fail
node tests\smoke-core.js || goto :fail
node tests\profile-reset.js || goto :fail
node tests\u1-foundation.js || goto :fail
node tests\u2-first-orbit.js || goto :fail
node tests\warfront-maintenance.js || goto :fail
node tests\stability-fuzz.js || goto :fail
node tests\data-integrity.js || goto :fail
node tests\dom-contract.js || goto :fail
node tests\u3-background-save-brand.js || goto :fail
node tests\u3-1-save-recovery-accessibility.js || goto :fail
node tests\u3-capacity-defense.js || goto :fail
node tests\u4-indexeddb-durability.js || goto :fail
node tests\u4-1-idempotent-commands.js || goto :fail
node tests\u4-1-server-time.js || goto :fail
node tests\u4-2-authoritative-server.js || goto :fail
node tests\u4-2-http-concurrency.js || goto :fail
node tests\u4-2-reconciliation-coverage.js || goto :fail
node tests\u4-3-sqlite-persistence.js || goto :fail
node tests\u4-3-process-restart-http.js || goto :fail
node tests\u4-3-sqlite-concurrency.js || goto :fail
node tests\u4-3-network-adapter.js || goto :fail
node tests\u4-3-signed-flow-save.js || goto :fail
node tests\u4-3-1-groundfront-reset.js || goto :fail
node tests\u4-3-1-authoritative-reset.js || goto :fail
node tests\u4-3-2-power-input.js || goto :fail
node tests\u4-3-3-factory-intelligence.js || goto :fail
node tests\p0-spatial-sim.js || goto :fail
echo.
echo ALL 27 TESTS PASSED
pause
exit /b 0
:fail
echo.
echo TEST FAILED
pause
exit /b 1

