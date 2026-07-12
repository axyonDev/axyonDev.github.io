@echo off
cd /d C:\Users\axy20\Desktop\TEST
echo.
echo  ======================================
echo   🤖 AXY Crystal Bot Launcher
echo  ======================================
echo.
echo  Crystal Drop Bot  baslatiliyor...
echo  Crystal Merge Bot baslatiliyor...
echo.

start "Crystal Drop Bot"  cmd /k "node crystal_drop_bot.js"
timeout /t 1 /nobreak >nul
start "Crystal Merge Bot" cmd /k "node crystal_merge_bot.js"

echo  Her iki bot ayri pencerelerde calisiyor!
echo  Kapatmak icin pencereleri kapatin.
echo.
