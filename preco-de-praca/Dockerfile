FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# Certificados da ICP-Brasil para validar a cadeia das assinaturas; o build segue sem eles se o site do ITI falhar
RUN node src/cli/baixar-icp.ts || echo "AVISO: certificados da ICP-Brasil não baixados; notas serão aceitas sem verificar a cadeia"
EXPOSE 3000
CMD ["node", "src/server.ts"]
