#!/usr/bin/env bash
# Scaffold: an empty git repo with the benign fixture skill at ./candidate (inert test content).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p candidate
cp -R "$here/../../fixtures/skills/benign-skill/." candidate/
git init -q -b main
