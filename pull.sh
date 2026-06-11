#!/bin/bash
set -e

echo "==> Pulling liveboard..."
git pull

echo ""
echo "==> Pulling src/modules..."
cd src/modules
git pull

echo ""
echo "Done."
