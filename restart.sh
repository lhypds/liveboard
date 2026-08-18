#!/bin/bash
set -e
bash pull.sh
# No --include=dev here: that is an npm flag. pnpm parses it as a package name and installs the
# unrelated npm package `dev`, rewriting package.json and pnpm-lock.yaml on every restart. pnpm
# ignores NODE_ENV=production and installs devDependencies anyway, so the build gets typescript/vite.
pnpm install

# pull.sh discards a rewritten pnpm-lock.yaml on the way in; `pnpm install` immediately writes it
# again, because this deploy's board.config.json selects a different module set than the lockfile
# was committed from and src/modules/* are workspace packages (one `importers:` entry each). The
# install is done by now, so drop the rewrite and leave a clean tree — same rule as pull.sh: only
# when it is the sole local change, so a machine with real work stays untouched.
if ! git diff --quiet HEAD -- pnpm-lock.yaml \
  && [ -z "$(git diff --name-only HEAD | grep -v '^pnpm-lock\.yaml$')" ]; then
  git checkout HEAD -- pnpm-lock.yaml
fi

pnpm run build
pnpm pm2 restart ecosystem.config.cjs --update-env
