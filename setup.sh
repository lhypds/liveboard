#!/bin/bash
set -e

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Copied .env.example to .env"
fi

if [ ! -f board.config.json ]; then
  cp board.config.json.example board.config.json
  echo "Copied board.config.json.example to board.config.json"
fi

bash pull.sh

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Setup complete."
