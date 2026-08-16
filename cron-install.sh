#!/usr/bin/env bash
# Puts one of this board's data crawls on a schedule.
#
# Run it with nothing after it and it asks four questions — which module repo, which component in
# it, which script to run, and how often — offering a list each time. Every answer can also be given
# up front instead, which is what a deploy script wants:
#
#   ./cron-install.sh                                     ask
#   ./cron-install.sh News --schedule "0 */4 * * *" -- --force
#   ./cron-install.sh --all                               every component that ships a fetch.sh
#   ./cron-install.sh --list                              what this board has installed
#   ./cron-install.sh --dry-run                           print the line, install nothing
#
# Idempotent, and safe on a crontab that has other things in it: every line it writes is tagged with
# a marker naming this board's directory, and only lines carrying that marker are ever replaced or
# removed. Two boards on one machine therefore do not tread on each other, and the crontab is saved
# to logs/crontab.bak before it is rewritten. ./cron-uninstall.sh takes the entries out again.
#
# Output goes to logs/cron-<component>.log. Nothing else on the board schedules a crawl: the card
# header's Refresh button only re-reads what is already on disk (see docs/10_Data API.md).
set -euo pipefail
cd "$(dirname "$0")"
BOARD="$PWD"
LOG_DIR="$BOARD/logs"
DEFAULT_SCHEDULE="0 6 * * *"

# ── the crontab, and the lines this board owns ────────────────────────────────────────────────────
# A missing crontab is not an error — it is the normal state of a fresh machine, and `crontab -l`
# reports it on stderr with a non-zero exit.
read_crontab() { crontab -l 2>/dev/null || true; }

# Component names are the board's addresses and are unique across repos (see docs/10_Data API.md),
# so the name alone is enough to identify an entry.
marker_of() { printf '# liveboard:%s:%s' "$BOARD" "$1"; }

# cron reads an unescaped % as a newline and hands everything after the first one to the job on
# stdin, so a board path or an argument carrying one has to be escaped rather than passed through.
escape_percent() { printf '%s' "$1" | sed 's/%/\\%/g'; }

# ── what is on disk ───────────────────────────────────────────────────────────────────────────────
# The module directories are separate clones (see pull.sh), so what can be scheduled is a question
# about this machine right now rather than a fixed list. setup.sh is never offered: it is the thing
# you run once by hand, not something to put on a timer.
scripts_in() {
  local dir="$1" script name
  for script in "$dir"/*.sh; do
    [ -f "$script" ] || continue
    name="$(basename "$script")"
    [ "$name" = "setup.sh" ] || printf '%s\n' "$name"
  done
  return 0
}

components_in() {
  local repo="$1" dir
  for dir in "src/modules/$repo"/*/; do
    [ -d "$dir" ] || continue
    if [ -n "$(scripts_in "${dir%/}")" ]; then printf '%s\n' "$(basename "$dir")"; fi
  done
  return 0
}

repos_with_components() {
  local dir repo
  for dir in src/modules/*/; do
    [ -d "$dir" ] || continue
    repo="$(basename "$dir")"
    if [ -n "$(components_in "$repo")" ]; then printf '%s\n' "$repo"; fi
  done
  return 0
}

# `mapfile` would say this in one line, but it is a bash 4 builtin and macOS still ships 3.2 — so
# the boards get read the long way round, which every bash has.
read_lines() {
  local __name="$1" __line
  eval "$__name=()"
  while IFS= read -r __line; do
    [ -n "$__line" ] || continue
    eval "$__name+=(\"\$__line\")"
  done
}

# Every component that ships a fetch.sh — what --all schedules, and how a name given on the
# command line is resolved to a path.
declare -a ALL_NAMES=() ALL_PATHS=()
for script in src/modules/*/*/fetch.sh; do
  [ -f "$script" ] || continue
  ALL_NAMES+=("$(basename "$(dirname "$script")")")
  ALL_PATHS+=("$BOARD/$script")
done

# ── asking ────────────────────────────────────────────────────────────────────────────────────────
# A numbered list, with the answer left in CHOICE as a 1-based index. A global rather than something
# echoed for the caller to capture: `q` has to be able to end the run, and an `exit` inside a $( )
# only ends the subshell it is being read in — the caller would carry on with an empty answer.
CHOICE=0
ask_choice() {
  local heading="$1"; shift
  local n=$# i=1 reply
  printf '\n%s\n' "$heading" >&2
  for item in "$@"; do
    printf '  %2d) %s\n' "$i" "$item" >&2
    i=$((i + 1))
  done
  while true; do
    printf 'Choose [1-%d, q to quit]: ' "$n" >&2
    read -r reply || reply="q"
    case "$reply" in
      q|Q) echo "Cancelled — nothing installed." >&2; exit 0 ;;
      ''|*[!0-9]*) ;;
      *) if [ "$reply" -ge 1 ] && [ "$reply" -le "$n" ]; then CHOICE="$reply"; return 0; fi ;;
    esac
    printf '  Not one of the choices.\n' >&2
  done
}

SCHED_LABELS=(
  "Every 15 minutes"
  "Every hour, on the hour"
  "Every 2 hours"
  "Every 4 hours"
  "Every 6 hours"
  "Twice a day, 06:00 and 18:00"
  "Once a day, 06:00"
  "Once a day, 03:00"
  "Once a week, Monday 06:00"
  "Custom — type a cron expression"
)
SCHED_EXPRS=(
  "*/15 * * * *"
  "0 * * * *"
  "0 */2 * * *"
  "0 */4 * * *"
  "0 */6 * * *"
  "0 6,18 * * *"
  "0 6 * * *"
  "0 3 * * *"
  "0 6 * * 1"
  ""
)

valid_schedule() {
  # Five whitespace-separated fields is all cron asks of the line; the daemon judges the rest.
  [ "$(printf '%s' "$1" | awk '{print NF}')" = "5" ]
}

# ── options ───────────────────────────────────────────────────────────────────────────────────────
schedule=""
dry_run=0
list_only=0
do_all=0
names=()
passthrough=()

while [ $# -gt 0 ]; do
  case "$1" in
    --schedule) schedule="${2:-}"; shift 2 ;;
    --all|-a) do_all=1; shift ;;
    --list|-l) list_only=1; shift ;;
    --dry-run|-n) dry_run=1; shift ;;
    # The comment block at the top of this file, as far as the first line that is not one — so the
    # help and the source cannot drift apart, and neither can a line count.
    -h|--help) awk 'NR > 1 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "$0"; exit 0 ;;
    --) shift; passthrough=("$@"); break ;;
    -*) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
    *) names+=("$1"); shift ;;
  esac
done

if [ "$list_only" -eq 1 ]; then
  installed=$(read_crontab | { grep -F "# liveboard:$BOARD:" || true; })
  if [ -z "$installed" ]; then
    echo "No liveboard entries installed for $BOARD."
  else
    echo "Installed for $BOARD:"
    printf '%s\n' "$installed"
  fi
  exit 0
fi

# ── the four questions, or the answers already given ──────────────────────────────────────────────
declare -a target_names=() target_paths=() target_args=()

if [ "$do_all" -eq 1 ] || [ ${#names[@]} -gt 0 ]; then
  if [ ${#ALL_NAMES[@]} -eq 0 ]; then
    echo "No src/modules/*/*/fetch.sh found — run ./setup.sh first to clone the module repos." >&2
    exit 1
  fi
  # Named components are checked against what is actually there, so a typo is a message rather than
  # a crontab that silently schedules nothing.
  if [ ${#names[@]} -gt 0 ]; then
    for wanted in "${names[@]}"; do
      found=0
      for i in "${!ALL_NAMES[@]}"; do
        if [ "${ALL_NAMES[$i]}" = "$wanted" ]; then
          target_names+=("$wanted"); target_paths+=("${ALL_PATHS[$i]}"); found=1; break
        fi
      done
      if [ "$found" -eq 0 ]; then
        echo "No component named '$wanted' with a fetch.sh. Available:" >&2
        printf '  %s\n' "${ALL_NAMES[@]}" >&2
        exit 1
      fi
    done
  else
    target_names=("${ALL_NAMES[@]}")
    target_paths=("${ALL_PATHS[@]}")
  fi
  [ -z "$schedule" ] && schedule="$DEFAULT_SCHEDULE"
  args=""
  if [ ${#passthrough[@]} -gt 0 ]; then
    args=" $(printf '%q ' "${passthrough[@]}")"; args="${args% }"
  fi
  for _ in "${target_names[@]}"; do target_args+=("$args"); done
else
  if [ ! -t 0 ]; then
    echo "Nothing to install and no terminal to ask on." >&2
    echo "Name a component, or pass --all. See --help." >&2
    exit 1
  fi

  read_lines repos < <(repos_with_components)
  if [ ${#repos[@]} -eq 0 ]; then
    echo "No module repos with runnable scripts under src/modules — run ./setup.sh first." >&2
    exit 1
  fi
  ask_choice "==> 1/4  Which module repo?" "${repos[@]}"
  repo="${repos[$((CHOICE - 1))]}"

  read_lines comps < <(components_in "$repo")
  ask_choice "==> 2/4  Which component in $repo?" "${comps[@]}"
  comp="${comps[$((CHOICE - 1))]}"
  comp_dir="src/modules/$repo/$comp"

  read_lines cmds < <(scripts_in "$comp_dir")
  ask_choice "==> 3/4  Which script in $comp?" "${cmds[@]}"
  cmd="${cmds[$((CHOICE - 1))]}"

  # Arguments rather than a fifth list: which ones a given script takes is its own business, and the
  # one that matters here is the same everywhere — a fetch that stops at today's file needs telling
  # when it is meant to run again the same day.
  printf '\n    Arguments for %s, if any. A fetch usually stops as soon as it sees the\n' "$cmd" >&2
  printf '    file for today, so scheduling it more than once a day wants --force.\n' >&2
  printf 'Arguments [Enter for none]: ' >&2
  read -r extra || extra=""

  labels=()
  for i in "${!SCHED_LABELS[@]}"; do
    if [ -n "${SCHED_EXPRS[$i]}" ]; then
      labels+=("$(printf '%-30s %s' "${SCHED_LABELS[$i]}" "${SCHED_EXPRS[$i]}")")
    else
      labels+=("${SCHED_LABELS[$i]}")
    fi
  done
  ask_choice "==> 4/4  How often should it run?" "${labels[@]}"
  schedule="${SCHED_EXPRS[$((CHOICE - 1))]}"
  while [ -z "$schedule" ]; do
    printf '\n    Five fields: minute hour day-of-month month day-of-week.\n' >&2
    printf 'Cron expression: ' >&2
    read -r schedule || schedule=""
    if ! valid_schedule "$schedule"; then
      printf '  "%s" is not five fields.\n' "$schedule" >&2
      schedule=""
    fi
  done

  target_names=("$comp")
  target_paths=("$BOARD/$comp_dir/$cmd")
  target_args=("${extra:+ $extra}")
fi

if ! valid_schedule "$schedule"; then
  echo "Schedule \"$schedule\" is not five fields (minute hour day-of-month month day-of-week)." >&2
  exit 1
fi

# ── the lines ─────────────────────────────────────────────────────────────────────────────────────
# cron gives a job almost no PATH, which is what breaks a crawl that runs perfectly by hand: node is
# usually under nvm or /usr/local, and the News crawler also looks for the optional `ft`. So the
# directories those are actually in — resolved in this shell, which is one where they work — are
# pinned into each line. Only those, plus the usual three: copying the whole of $PATH in would put
# thirty unreadable directories on every line of `crontab -l`. Inline rather than as a crontab-wide
# PATH= assignment, which would silently apply to everyone else's jobs in the same file.
CRON_PATH=""
add_path() {
  case ":$CRON_PATH:" in
    *":$1:"*) ;;
    *) CRON_PATH="${CRON_PATH:+$CRON_PATH:}$1" ;;
  esac
}
for cmd_name in node ft; do
  if resolved=$(command -v "$cmd_name" 2>/dev/null); then add_path "$(dirname "$resolved")"; fi
done
for dir in /usr/local/bin /usr/bin /bin; do add_path "$dir"; done

if ! command -v node >/dev/null 2>&1; then
  echo "WARNING: node is not on PATH in this shell, so the cron entries will not find it either." >&2
  echo "         Run this from a shell where 'node -v' works." >&2
fi

lines=()
for i in "${!target_names[@]}"; do
  name="${target_names[$i]}"
  lines+=("$(escape_percent "$schedule PATH=\"$CRON_PATH\" \"${target_paths[$i]}\"${target_args[$i]} >> \"$LOG_DIR/cron-$name.log\" 2>&1 $(marker_of "$name")")")
done

echo ""
echo "Board:     $BOARD"
echo "Component: ${target_names[*]}"
echo "Schedule:  $schedule"
echo "Log:       $LOG_DIR/cron-<component>.log"
echo ""
echo "Entries:"
printf '  %s\n' "${lines[@]}"
echo ""

if [ "$dry_run" -eq 1 ]; then
  echo "Dry run — nothing installed."
  exit 0
fi

if [ -t 0 ]; then
  read -r -p "Install? [Y/n] " reply || reply=""
  case "$reply" in
    n|N|no|NO) echo "Nothing installed."; exit 0 ;;
  esac
fi

# ── writing it ────────────────────────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

current=$(read_crontab)
# Kept before the rewrite, so a crontab this script gets wrong is one command away from being
# restored (crontab logs/crontab.bak).
if [ -n "$current" ]; then
  printf '%s\n' "$current" > "$LOG_DIR/crontab.bak"
fi

# Only this board's entries for the components being installed are dropped; everything else in the
# crontab — including this board's other components — is carried through untouched.
updated="$current"
for name in "${target_names[@]}"; do
  updated=$(printf '%s\n' "$updated" | { grep -vF "$(marker_of "$name")" || true; })
done
for line in "${lines[@]}"; do
  updated=$(printf '%s\n%s' "$updated" "$line")
done

printf '%s\n' "$updated" | { grep -v '^$' || true; } | crontab -

echo "Installed ${#target_names[@]} entr$([ ${#target_names[@]} -eq 1 ] && echo y || echo ies): ${target_names[*]}"
[ -f "$LOG_DIR/crontab.bak" ] && echo "Previous crontab saved to $LOG_DIR/crontab.bak"
echo "Check with: crontab -l   |   remove with: ./cron-uninstall.sh"
