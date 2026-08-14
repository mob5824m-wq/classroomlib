@echo off
REM Start the Classroom Library server on Windows.
REM
REM 1. Edit the line below to point at where you cloned the repo.
REM 2. Run it once to start the server, OR add a shortcut to this file in the
REM    Startup folder (Win+R -> shell:startup) so it starts when you log in.
REM
REM The server listens on 0.0.0.0:8080.
cd /d C:\path\to\classroomlib
node server.js
