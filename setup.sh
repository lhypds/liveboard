#!/bin/bash
set -e

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Copied .env.example to .env"
fi

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Setup complete."
