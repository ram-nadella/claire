#!/usr/bin/env bash
# Installs dependencies into the node_modules volume whenever package.json or
# package-lock.json changes, then runs the requested command. Set SKIP_INSTALL=1 to skip
# the check (e.g. to run `npm install` yourself after hand-editing package.json).
set -euo pipefail
cd /app

if [ "${SKIP_INSTALL:-0}" != "1" ] && [ -f package.json ]; then
  deps_hash=$(cat package.json package-lock.json | sha256sum | cut -d' ' -f1)
  stamp=node_modules/.claire-deps-hash
  if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$deps_hash" ]; then
    echo "[claire-dev] package.json or package-lock.json changed; running npm ci..." >&2
    npm ci --no-audit --no-fund
    echo "$deps_hash" > "$stamp"
  fi
fi

exec "$@"
