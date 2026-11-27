#!/usr/bin/env bash
# Installs dependencies into the node_modules volume whenever package.json or yarn.lock
# changes, then runs the requested command. Set SKIP_INSTALL=1 to skip the check
# (e.g. to run `yarn install` yourself after hand-editing package.json). With no
# package.json (between plan chunks 0.1 and 1.1) there is nothing to install.
set -euo pipefail
cd /app

if [ "${SKIP_INSTALL:-0}" != "1" ] && [ -f package.json ]; then
  deps_hash=$(cat package.json yarn.lock | sha256sum | cut -d' ' -f1)
  stamp=node_modules/.claire-deps-hash
  if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$deps_hash" ]; then
    echo "[claire-dev] package.json or yarn.lock changed; running yarn install..." >&2
    yarn install --frozen-lockfile --non-interactive
    echo "$deps_hash" > "$stamp"
  fi
fi

exec "$@"
