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

# modules.config.json
for example in src/modules/*/modules.config.json.example; do
  target="${example%.example}"
  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    echo "Copied $example to $target"
  fi
done


bash pull.sh

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Setup complete."
