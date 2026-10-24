@echo off
rem Fake `claude` for the installer tests (Windows shim).
node "%~dp0fake-claude.mjs" %*
