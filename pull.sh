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

# modules.config.json is gitignored but imported by each module's index.ts, so a freshly cloned
# module needs it before the build. Done here rather than only in setup.sh because restart.sh also
# clones new modules (via this script) and goes straight to the build.
for example in src/modules/*/modules.config.json.example; do
  [ -f "$example" ] || continue
  target="${example%.example}"
  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    echo "  Copied $example to $target"
  fi
done

echo ""
echo "Done."
