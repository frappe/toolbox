#!/usr/bin/env bash
#
# The whole QA suite, in one command.
#
#   bash qa/run-qa.sh                  every layer
#   bash qa/run-qa.sh --fast           the two-minute gate
#   bash qa/run-qa.sh --layer=browser  one layer
#   bash qa/run-qa.sh --target=prod    the read-only layers against frappe.tools
#   bash qa/run-qa.sh --update-visual  re-record the screenshot baselines
#   bash qa/run-qa.sh --update-baseline  record the numbers from a full green run
#
# This script owns the bench. It cannot be started in its own tool call and survive, so the server
# and the work that needs it run here together. `socketio` and `schedule` are left out on purpose:
# both exit at once on this machine, and honcho stops every process when any one of them exits.

set -uo pipefail

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bench_root="$(cd "$app_root/../.." && pwd)"
site="${TOOLBOX_TEST_SITE:-toolbox-test.localhost}"
bench_log="${TMPDIR:-/tmp}/toolbox-qa-bench.log"
lock_file="${TMPDIR:-/tmp}/toolbox-qa.lock"

target="local"
for arg in "$@"; do
  [[ "$arg" == "--target=prod" ]] && target="prod"
done

# A second matrix, or a build beside one, starves the single web server. Every spec then fails on a
# 30-second navigation timeout that reads exactly like a real regression. It has caused a wrong
# diagnosis more than once, so the run refuses to start rather than produce a report that lies.
guard_against_concurrent_runs() {
  local busy=""
  # The bracket around the first letter stops the pattern matching a shell whose own command line
  # happens to contain it — including the one that invoked this script. Without it, wrapping the
  # run in a command that names "playwright test" makes the guard refuse on the strength of its
  # own arguments.
  pgrep -f "[p]laywright test" >/dev/null 2>&1 && busy+="  a Playwright run is active\n"
  pgrep -f "[v]itest" >/dev/null 2>&1 && busy+="  a vitest run is active\n"

  if [[ -e "$lock_file" ]]; then
    local owner
    owner="$(cat "$lock_file" 2>/dev/null)"
    if [[ -n "$owner" ]] && kill -0 "$owner" 2>/dev/null; then
      busy+="  another QA run is active (pid $owner)\n"
    else
      rm -f "$lock_file"
    fi
  fi

  if [[ -n "$busy" ]]; then
    printf 'Refusing to start. Something else is using this machine:\n%b' "$busy"
    printf 'Run the suite on its own, or its failures will be timeouts rather than defects.\n'
    exit 2
  fi

  echo $$ >"$lock_file"
}

# An orphan redis from an earlier run holds the port, the new one fails to bind, and honcho gives
# up. These three ports belong to this bench: 8100 is its web server, 11100 and 13100 its two redis
# instances. Port 8000 is the Draw bench and is never touched.
#
# This kills processes, so it says what it killed. Somebody else's bench on this port is the one
# thing that would make the report meaningless, and a silent kill would hide it.
free_the_ports() {
  for port in 8100 11100 13100; do
    local holders
    holders="$(lsof -ti tcp:"$port" 2>/dev/null)"
    [[ -z "$holders" ]] && continue
    while read -r pid; do
      printf '   port %s was held by pid %s (%s); stopping it\n' \
        "$port" "$pid" "$(ps -p "$pid" -o comm= 2>/dev/null || echo unknown)"
    done <<<"$holders"
    echo "$holders" | xargs kill 2>/dev/null
  done
  sleep 1
}

start_bench() {
  printf '── Bench ──\n'
  free_the_ports
  (cd "$bench_root" && honcho start -f Procfile redis_cache redis_queue web worker) \
    >"$bench_log" 2>&1 &
  bench_pid=$!

  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null "http://$site:8100/api/method/ping"; then
      printf '   up on :8100\n'
      return 0
    fi
    sleep 2
  done

  printf '   the bench never answered on :8100\n'
  tail -30 "$bench_log"
  return 1
}

# The long-running web worker on this bench cannot make outbound HTTP, although `bench execute` on
# the same machine can. Without this the Currency Converter answers 503 and reads as a broken tool.
warm_provider_caches() {
  (cd "$bench_root" && bench --site "$site" execute toolbox.currency.get_reference_rates) \
    >>"$bench_log" 2>&1 && printf '   currency rates cached\n' ||
    printf '   currency rates could not be cached; the converter will report no rates\n'
}

clean_up() {
  rm -f "$lock_file"
  [[ -n "${bench_pid:-}" ]] || return 0
  # Killing the process group would take this script down with it, so honcho is killed by pid and
  # its children are cleared by the ports they hold. Killing honcho alone leaves the web server and
  # both redis instances running: every run then left an orphan bench behind, and the next run
  # started against a machine already carrying one. That is how a green suite turned into three
  # WebKit timeouts.
  kill "$bench_pid" 2>/dev/null
  wait "$bench_pid" 2>/dev/null
  free_the_ports >/dev/null
}

main() {
  if [[ "$target" == "prod" ]]; then
    printf 'Running the read-only layers against production. No bench, no build.\n'
    node "$app_root/qa/runner/index.mjs" "$@"
    return $?
  fi

  guard_against_concurrent_runs
  trap clean_up EXIT
  start_bench || return 1
  warm_provider_caches

  node "$app_root/qa/runner/index.mjs" "$@"
}

main "$@"
exit $?
