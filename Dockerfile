# Runs the Maruf Cafe server anywhere Docker runs. Build from this folder:  docker build -t maruf-cafe .
# The built phone app is already in public/app, so nothing else is installed or compiled here.
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /srv/maruf-cafe
COPY package.json server.mjs ./
COPY lib ./lib
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
# Requests, photos and menu edits live here. Keep it on a volume or the data is lost when the container is replaced.
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- "http://127.0.0.1:${PORT}/api/config" > /dev/null || exit 1
CMD ["node", "server.mjs"]
