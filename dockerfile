FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm install --production

COPY backend/ ./

WORKDIR /app
COPY frontend/ ./frontend/

WORKDIR /app/backend
CMD ["node", "server.js"]
