# Imagem única usada pela API e pelo mock do autorizador no docker-compose.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
EXPOSE 3000 4010
CMD ["npm", "start"]
