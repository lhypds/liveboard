#!/bin/bash
set -e

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Copied .env.example to .env"
fi

if [ ! -d src/modules ]; then
  echo "Modules folder not found. Pulling liveboard-mod..."
  git clone https://github.com/lhypds/liveboard-mod.git src/modules
  echo "Modules pulled."
fi

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Setup complete."
