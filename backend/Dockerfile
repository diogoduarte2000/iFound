FROM node:22-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/storage
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
