#!/bin/bash
set -e
bash pull.sh
# No --include=dev here: that is an npm flag. pnpm parses it as a package name and installs the
# unrelated npm package `dev`, rewriting package.json and pnpm-lock.yaml on every restart. pnpm
# ignores NODE_ENV=production and installs devDependencies anyway, so the build gets typescript/vite.
pnpm install
pnpm run build
pnpm pm2 restart ecosystem.config.cjs --update-env
