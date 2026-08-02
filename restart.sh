#!/bin/bash
set -e
bash pull.sh
# --include=dev: the build needs typescript/vite/@types, which npm skips when the deploy shell has
# NODE_ENV=production (or omit=dev in .npmrc). Without it `npm run build` dies on TS2688.
npm install --include=dev
npm run build
pm2 restart ecosystem.config.cjs --update-env
