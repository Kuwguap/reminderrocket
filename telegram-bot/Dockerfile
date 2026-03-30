FROM node:22-alpine
WORKDIR /app
RUN mkdir -p lib
COPY lib/nyTime.js ./lib/nyTime.js
WORKDIR /app/telegram-bot
COPY telegram-bot/package.json ./
RUN npm install --omit=dev
COPY telegram-bot/index.mjs ./
CMD ["node", "index.mjs"]
