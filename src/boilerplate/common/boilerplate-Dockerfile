FROM node:18.19

WORKDIR /app


COPY ./package.json ./package-lock.json ./
RUN npm ci
EXPOSE 3000
