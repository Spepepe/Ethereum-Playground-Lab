# ---- Base ----
FROM node:20-alpine

# ---- Set up working directory ----
WORKDIR /app

# ---- Install dependencies ----
COPY package*.json ./
RUN npm install

# ---- Copy source code ----
COPY . .

# ---- Expose port ----
EXPOSE 3000

# ---- Command ----
CMD ["npm", "run", "start:dev"]
