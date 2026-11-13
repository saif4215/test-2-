#!/bin/sh
# Double-click this on a Mac to start the cafe's server.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node is not installed. Get the LTS version from https://nodejs.org , install it, then double-click this again."
  read -r _ 
  exit 1
fi
node scripts/start.mjs
