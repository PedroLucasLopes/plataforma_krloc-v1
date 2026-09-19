# syntax=docker/dockerfile:1

########################  build  #######################
FROM node:22-alpine AS build
WORKDIR /app

# @pedrolucaslopes/dotlog-ui vem do GitHub Packages, que exige token ate para
# instalar. O .npmrc versionado so diz ONDE buscar e le o token do ambiente. O
# token entra como secret do BuildKit: existe durante este RUN e nao fica em
# camada nenhuma. ARG e ENV ficariam gravados na imagem.
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN npm ci

COPY . .
# `npm run build` roda type-check (vue-tsc), check:locales e vite build.
RUN npm run build

#######################  runtime  ######################
# nginx-unprivileged ja escuta em 8080 e roda como usuario nao-root,
# que e exatamente o contrato do Cloud Run.
FROM nginxinc/nginx-unprivileged:1.31-alpine AS runtime

# Vazio desliga o repasse de /api: em producao quem roteia e o rewrite do
# hosting, e o nginx nunca recebe essas chamadas. O compose preenche.
ENV KRLOC_UPSTREAM=""

# A imagem aplica envsubst em /etc/nginx/templates/*.template no boot.
COPY --chown=nginx:nginx nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
EXPOSE 8080
