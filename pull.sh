#!/bin/bash
set -e

# Load COMPONENTS_GIT_URL from .env if present
if [ -f .env ]; then
  COMPONENTS_GIT_URL=$(grep '^COMPONENTS_GIT_URL=' .env | cut -d'=' -f2-)
fi

echo "==> Pulling liveboard..."
git pull

echo ""
echo "==> Pulling src/modules..."
if [ -n "$COMPONENTS_GIT_URL" ]; then
  if [ -d src/modules/.git ]; then
    cd src/modules
    git pull
  else
    rm -rf src/modules
    git clone "$COMPONENTS_GIT_URL" src/modules
  fi
else
  cd src/modules
  git pull
fi

echo ""
echo "Done."
