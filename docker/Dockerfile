# Dev environment for Claire: Node toolchain for lint, tests and build, with network access.
#
# The current toolchain (webpack 3, jest 20, eslint 3) dates from 2018, so this pins an
# older Node by default. Bump NODE_VERSION (here and in compose.yaml) when the toolchain
# is upgraded.
ARG NODE_VERSION=16
FROM node:${NODE_VERSION}-bullseye-slim

# yarn v1 ships with the official node images.
WORKDIR /app

COPY docker/entrypoint.sh /usr/local/bin/claire-entrypoint
RUN chmod 755 /usr/local/bin/claire-entrypoint \
 && mkdir -p /app/node_modules /home/node/.cache/yarn \
 && chown -R node:node /app /home/node/.cache

# Run as the image's non-root user so files written to the bind mount (dist/, yarn.lock)
# aren't root-owned on Linux hosts. Named volumes inherit this ownership on first use.
USER node
ENV YARN_CACHE_FOLDER=/home/node/.cache/yarn

ENTRYPOINT ["claire-entrypoint"]
CMD ["bash"]
