FROM node:18-alpine AS build-frontend

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY BE/package*.json ./BE/
RUN cd BE && npm install --omit=dev

COPY BE/dist ./BE/dist
COPY BE/prisma ./BE/prisma
COPY BE/.env ./BE/.env

RUN cd BE && npx prisma generate

COPY --from=build-frontend /app/BE/public ./BE/public

EXPOSE 3000

WORKDIR /app/BE

CMD ["node", "dist/src/main.js"]
