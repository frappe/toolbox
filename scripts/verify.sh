#!/usr/bin/env bash

set -euo pipefail

app_root="$(cd "$(dirname "$0")/.." && pwd)"
bench_root="$(cd "$app_root/../.." && pwd)"
test_site="${TOOLBOX_TEST_SITE:-toolbox-test.localhost}"
e2e_base_url="${TOOLBOX_E2E_BASE_URL:-http://toolbox-test.localhost:8100}"

curl --fail --silent --show-error "$e2e_base_url/toolbox/all-tools" >/dev/null

yarn --cwd "$app_root/frontend" test
yarn --cwd "$app_root/frontend" build
(cd "$bench_root" && bench --site "$test_site" run-tests --app toolbox)
yarn --cwd "$app_root/frontend" test:e2e
