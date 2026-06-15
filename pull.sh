#!/bin/bash
set -e

# Load componentsGitUrl from board.config.json if present
if [ -f board.config.json ]; then
  COMPONENTS_GIT_URL=$(node -e "const c=require('./board.config.json'); process.stdout.write(c.componentsGitUrl || '')" 2>/dev/null)
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
