#!/bin/bash
set -e

# Load componentsGitUrl (array) from board.config.json if present
COMPONENTS_GIT_URLS=()
if [ -f board.config.json ]; then
  while IFS= read -r url; do
    [ -n "$url" ] && COMPONENTS_GIT_URLS+=("$url")
  done < <(node -e "const c=require('./board.config.json'); const urls=Array.isArray(c.componentsGitUrl)?c.componentsGitUrl:[]; urls.forEach(u=>console.log(u))" 2>/dev/null)
fi

echo "==> Pulling liveboard..."

# `pnpm install` rewrites pnpm-lock.yaml whenever a module repo changes its own dependencies, and
# also whenever this deploy's board.config.json selects a different set of module repos than the
# committed lockfile was generated from — src/modules/* are workspace packages, so they get an
# entry each under `importers:`. On a deploy clone that regenerated lockfile is not the source of
# truth, and leaving it modified makes the pull below abort ("Your local changes ... would be
# overwritten by merge"), taking restart.sh down with it.
# Only discard it when it is the sole local change, so a machine with real work stays untouched.
if ! git diff --quiet HEAD -- pnpm-lock.yaml; then
  if [ -z "$(git diff --name-only HEAD | grep -v '^pnpm-lock\.yaml$')" ]; then
    echo "  Discarding regenerated pnpm-lock.yaml (pnpm install rewrites it)..."
    git checkout HEAD -- pnpm-lock.yaml
  else
    echo "  NOTE: pnpm-lock.yaml is modified alongside other local changes — leaving it as is."
    echo "        If the pull below fails, commit or stash your changes first."
  fi
fi

git pull

echo ""
echo "==> Pulling src/modules..."
if [ ${#COMPONENTS_GIT_URLS[@]} -gt 0 ]; then
  mkdir -p src/modules
  for url in "${COMPONENTS_GIT_URLS[@]}"; do
    dir_name=$(basename "$url" .git)
    dir_name="${dir_name#liveboard-mod-}"
    dest="src/modules/$dir_name"
    if [ -d "$dest/.git" ]; then
      echo "  Pulling $dest..."
      git -C "$dest" pull
    else
      echo "  Cloning $url -> $dest..."
      git clone "$url" "$dest"
    fi
  done
else
  cd src/modules
  git pull
fi

echo ""
echo "==> Removing stale src/modules..."
if [ -d src/modules ]; then
  # Build the set of expected dir names from config
  EXPECTED_DIRS=()
  for url in "${COMPONENTS_GIT_URLS[@]}"; do
    dname=$(basename "$url" .git)
    dname="${dname#liveboard-mod-}"
    EXPECTED_DIRS+=("$dname")
  done

  for entry in src/modules/*/; do
    [ -d "$entry" ] || continue
    dname=$(basename "$entry")
    found=0
    for expected in "${EXPECTED_DIRS[@]}"; do
      [ "$dname" = "$expected" ] && found=1 && break
    done
    if [ $found -eq 0 ]; then
      echo "  Removing $entry (not in board.config.json)..."
      rm -rf "$entry"
    fi
  done
fi

echo ""
echo "Done."
