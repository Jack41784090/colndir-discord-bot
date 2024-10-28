# 1. Build

FROM node:20-slim as BUILD

WORKDIR /condor

COPY . .

RUN npm install && npm run compile

# 2. Export

FROM node:20-slim

WORKDIR /condor

COPY package.json ./
COPY tsconfig.json ./

RUN ls -la && npm install --omit=dev

COPY --from=BUILD /condor/dist ./dist

COPY .env ./

CMD ["sh", "-c", "npm run start || tail -f /dev/null"]

