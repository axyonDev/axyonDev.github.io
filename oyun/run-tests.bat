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
echo.
echo ALL TESTS PASSED
pause
exit /b 0
:fail
echo.
echo TEST FAILED
pause
exit /b 1
