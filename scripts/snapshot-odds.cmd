@echo off
REM Capture an odds snapshot of every upcoming V75/V85/V86 card.
REM
REM Takes no arguments so Windows Task Scheduler stays dumb and the script stays
REM in charge of what counts as a card. Run it SEVERAL times a day: measuring
REM drift needs a reading close to post as well as one a day out, and a capture
REM you missed is gone for good.
REM
REM Register (adjust the repeat to taste):
REM   schtasks /create /tn "odds-snapshot" /tr "%~f0" /sc hourly /mo 2

cd /d "%~dp0.."
call npx tsx scripts/snapshot-odds.ts --auto >> "data\snapshot-odds.log" 2>&1
exit /b %errorlevel%
