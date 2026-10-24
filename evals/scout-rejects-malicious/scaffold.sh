#!/usr/bin/env bash
# Scaffold: an empty git repo with the malicious fixture skill at ./candidate (inert test content).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p candidate
cp -R "$here/../../fixtures/skills/malicious-skill/." candidate/
git init -q -b main
