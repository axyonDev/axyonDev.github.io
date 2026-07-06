@echo off
setlocal
for /r %%F in (*.js) do node --check "%%F" || goto :fail
node tests\smoke-core.js || goto :fail
echo.
echo ALL TESTS PASSED
pause
exit /b 0
:fail
echo.
echo TEST FAILED
pause
exit /b 1
