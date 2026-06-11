FROM node:20-alpine

# sharp butuh build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

CMD ["node", "dist/server.js"]
