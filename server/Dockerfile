FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src

# SQLite file lives in /data (a Docker volume, so it survives restarts)
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=4000 DB_DIR=/data
VOLUME /data
EXPOSE 4000

USER node
CMD ["node", "src/index.js"]
