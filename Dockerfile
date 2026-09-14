# ---------- Stage 1: build frontend (Vite) ----------
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_URL=https://mkt-hub.onrender.com/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---------- Stage 2: serve with Nginx ----------
FROM nginx:alpine

ENV BE_UPSTREAM=https://mkt-hub.onrender.com

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
