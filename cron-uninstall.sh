#!/usr/bin/env bash
# Takes this board's crawls off their schedule again.
#
# Run it with nothing after it and it lists what is installed and asks which one to remove. The
# answer can also be given up front, which is what a deploy script wants:
#
#   ./cron-uninstall.sh              ask, from a list of what is installed
#   ./cron-uninstall.sh News         that component's entry
#   ./cron-uninstall.sh --all        every entry this board owns
#   ./cron-uninstall.sh --dry-run    print what would go, remove nothing
#   ./cron-uninstall.sh --all -y     do not ask to confirm
#
# Only lines carrying this board's marker are touched, so another board's entries and anything else
# in the crontab survive, and the crontab is saved to logs/crontab.bak first. The crawled data on
# disk is left alone — this stops the schedule, it does not delete anything a card reads.
set -euo pipefail
cd "$(dirname "$0")"
BOARD="$PWD"
LOG_DIR="$BOARD/logs"

read_crontab() { crontab -l 2>/dev/null || true; }

dry_run=0
assume_yes=0
do_all=0
names=()

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run|-n) dry_run=1; shift ;;
    -y|--yes) assume_yes=1; shift ;;
    --all|-a) do_all=1; shift ;;
    -h|--help) awk 'NR > 1 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "$0"; exit 0 ;;
    -*) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
    *) names+=("$1"); shift ;;
  esac
done

current=$(read_crontab)
if [ -z "$current" ]; then
  echo "No crontab for this user — nothing to remove."
  exit 0
fi

# `mapfile` would say this in one line, but it is a bash 4 builtin and macOS still ships 3.2.
installed=()
while IFS= read -r line; do
  [ -n "$line" ] && installed+=("$line")
done < <(printf '%s\n' "$current" | { grep -F "# liveboard:$BOARD:" || true; })
if [ ${#installed[@]} -eq 0 ]; then
  echo "No liveboard entries installed for $BOARD."
  exit 0
fi

# An installed line read back: the component from its marker, the schedule from the five fields cron
# reads, and the command with its absolute path shortened to the script's own name.
name_of() { printf '%s' "${1##*:}"; }
summarise() {
  local line="$1" sched cmd script rest
  sched=$(printf '%s' "$line" | awk '{print $1, $2, $3, $4, $5}')
  cmd=$(printf '%s' "$line" | sed -e 's/.*PATH="[^"]*" //' -e 's/ >>.*//')
  script=$(printf '%s' "$cmd" | sed -e 's/^"//' -e 's/".*//')
  rest=$(printf '%s' "$cmd" | sed -e 's/^"[^"]*"//' -e 's/^ *//')
  printf '%-16s %-14s %s' "$(name_of "$line")" "$sched" "$(basename "$script")${rest:+ $rest}"
}

# What goes: everything this board owns, or only the named components' lines.
if [ "$do_all" -eq 1 ]; then
  patterns=("# liveboard:$BOARD:")
elif [ ${#names[@]} -gt 0 ]; then
  patterns=()
  for name in "${names[@]}"; do patterns+=("# liveboard:$BOARD:$name"); done
else
  if [ ! -t 0 ]; then
    echo "Nothing named and no terminal to ask on. Name a component, or pass --all." >&2
    exit 1
  fi
  labels=()
  for line in "${installed[@]}"; do labels+=("$(summarise "$line")"); done
  labels+=("All ${#installed[@]} of them")

  printf '\nInstalled for %s:\n' "$BOARD" >&2
  i=1
  for label in "${labels[@]}"; do
    printf '  %2d) %s\n' "$i" "$label" >&2
    i=$((i + 1))
  done
  n=${#labels[@]}
  while true; do
    printf 'Remove which [1-%d, q to quit]: ' "$n" >&2
    read -r reply || reply="q"
    case "$reply" in
      q|Q) echo "Cancelled — nothing removed." >&2; exit 0 ;;
      ''|*[!0-9]*) ;;
      *) if [ "$reply" -ge 1 ] && [ "$reply" -le "$n" ]; then break; fi ;;
    esac
    printf '  Not one of the choices.\n' >&2
  done
  if [ "$reply" -eq "$n" ]; then
    patterns=("# liveboard:$BOARD:")
  else
    patterns=("# liveboard:$BOARD:$(name_of "${installed[$((reply - 1))]}")")
  fi
fi

kept="$current"
doomed=""
for pattern in "${patterns[@]}"; do
  kept=$(printf '%s\n' "$kept" | { grep -vF "$pattern" || true; })
  hit=$(printf '%s\n' "$current" | { grep -F "$pattern" || true; })
  [ -n "$hit" ] && doomed="${doomed}${doomed:+$'\n'}$hit"
done

if [ -z "$doomed" ]; then
  echo "No liveboard entries found for $BOARD${names[*]:+ (${names[*]})}."
  exit 0
fi

echo ""
echo "Removing:"
while IFS= read -r line; do printf '  %s\n' "$(summarise "$line")"; done <<< "$doomed"
echo ""

if [ "$dry_run" -eq 1 ]; then
  echo "Dry run — nothing removed."
  exit 0
fi

# Asked for only when there is someone to ask: a deploy script piping this in gets on with it, the
# same way setup.sh treats a shell with no terminal.
if [ "$assume_yes" -eq 0 ] && [ -t 0 ]; then
  read -r -p "Remove? [y/N] " reply || reply=""
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Left alone."; exit 0 ;;
  esac
fi

mkdir -p "$LOG_DIR"
printf '%s\n' "$current" > "$LOG_DIR/crontab.bak"

if [ -z "$(printf '%s\n' "$kept" | { grep -v '^$' || true; })" ]; then
  # An empty crontab is removed rather than written as a blank file, which is what `crontab -r` is
  # for; on some systems piping nothing to `crontab -` is an error rather than an empty one.
  crontab -r 2>/dev/null || true
else
  printf '%s\n' "$kept" | crontab -
fi

echo "Removed. Previous crontab saved to $LOG_DIR/crontab.bak"
