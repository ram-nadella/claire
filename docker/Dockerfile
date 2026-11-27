# Dev environment for Claire: Node toolchain for lint, formatting and tests, with network
# access. The extension itself has no build step; this is for dev tooling only.
#
# Keep NODE_VERSION in sync with .node-version (compose.yaml passes it in).
ARG NODE_VERSION=26
FROM node:${NODE_VERSION}-slim

WORKDIR /app

COPY docker/entrypoint.sh /usr/local/bin/claire-entrypoint
RUN chmod 755 /usr/local/bin/claire-entrypoint \
 && mkdir -p /app/node_modules /home/node/.npm \
 && chown -R node:node /app /home/node/.npm

# Run as the image's non-root user so files written to the bind mount (package-lock.json,
# formatted sources) aren't root-owned on Linux hosts. Named volumes inherit this
# ownership on first use.
USER node
# Use the npm that ships with this Node (as CI does), without nagging to upgrade it.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

ENTRYPOINT ["claire-entrypoint"]
CMD ["bash"]
