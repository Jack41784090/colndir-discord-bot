FROM node:20-slim as BUILD

WORKDIR /condor

COPY package*.json ./

RUN npm install

COPY . .

RUN ls -la && cat package-lock.json && npm run compile


# FROM node:20-slim

# WORKDIR /condor

# COPY package*.json ./

# RUN npm install --omit=dev

# COPY --from=BUILD /condor/dist ./dist

# COPY .env ./

# CMD ["node", "dist/index.js"]
