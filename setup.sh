#!/bin/bash
set -e

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Copied .env.example to .env"
fi

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
