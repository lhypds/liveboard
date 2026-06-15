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
echo "Done."
