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

# modules.config.json (after pull so all module dirs exist)
for example in src/modules/*/modules.config.json.example; do
  target="${example%.example}"
  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    echo "Copied $example to $target"
  fi
done

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Setup complete."
