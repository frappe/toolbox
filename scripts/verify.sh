#!/usr/bin/env bash
#
# Kept as the name people already type. The QA suite is the release check now: it runs these four
# steps and six more, starts and stops its own bench, and writes one report.

set -euo pipefail

app_root="$(cd "$(dirname "$0")/.." && pwd)"

exec bash "$app_root/qa/run-qa.sh" "$@"
