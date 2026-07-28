#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Copied .env.example to .env"
fi

# Ask for a .env value that has none. Already-filled keys are left alone, and
# with no terminal to ask on (ssh deploy, CI) it reports instead of hanging.
ask_env() {
  local key="$1" hint="$2" value
  if grep -q "^$key=..*" .env; then
    echo "$key is already set."
    return 0
  fi
  if [ ! -t 0 ]; then
    echo "$key is not set in $PWD/.env — fill it in and re-run this script."
    return 0
  fi
  echo "$hint"
  read -r -p "$key (press Enter to skip): " value || value=""
  if [ -z "$value" ]; then
    echo "Skipped — $key left empty."
    return 0
  fi
  # Rewrite in place so comments and key order in .env survive. The value goes
  # through the environment, so | / & \ and friends need no escaping.
  if grep -q "^$key=" .env; then
    VALUE="$value" awk -v k="$key" \
      '$0 ~ "^" k "=" && !done { print k "=" ENVIRON["VALUE"]; done=1; next } { print }' \
      .env > .env.tmp
    mv .env.tmp .env
  else
    echo "$key=$value" >> .env
  fi
  echo "Saved $key to .env"
}

echo ""
echo "==> Checking root .env..."
ask_env HOST \
  "Public hostname this board is served from, e.g. liveboard.example.jp (leave empty for local development)."

# board.config.json
if [ ! -f board.config.json ]; then
  cp board.config.json.example board.config.json
  echo "Copied board.config.json.example to board.config.json"
fi

bash pull.sh

# Module setups (after pull so all module dirs exist).
# Each module's setup.sh copies its own modules.config.json and runs every
# component's setup.sh. Module setups are optional data plumbing — a failure is
# reported at the end instead of aborting the build.
echo ""
echo "==> Setting up modules..."
FAILED_MODULES=""
for setup in src/modules/*/setup.sh; do
  [ -f "$setup" ] || continue
  module=$(basename "$(dirname "$setup")")
  echo ""
  if ! bash "$setup"; then
    FAILED_MODULES="$FAILED_MODULES $module"
  fi
done

# modules.config.json — fallback for module repos that have no setup.sh yet
for example in src/modules/*/modules.config.json.example; do
  [ -f "$example" ] || continue
  target="${example%.example}"
  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    echo "Copied $example to $target"
  fi
done

echo ""
echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo ""
if [ -n "$FAILED_MODULES" ]; then
  echo "WARNING: module setup failed for:$FAILED_MODULES"
  echo "         The board is built, but those modules' data pipelines may not work."
  echo "         Re-run src/modules/<module>/setup.sh to see the error."
fi

echo "Setup complete."
