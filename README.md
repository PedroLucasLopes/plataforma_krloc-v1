# 🚧 KRLoc Plataforma

Front da locação de equipamentos do KRLoc: contratos e o ciclo deles, equipamentos, acessórios,
clientes e obras. Fala com a [API do KRLoc](https://github.com/PedroLucasLopes/krloc-api-v1) na mesma
origem, e quem entra passa pelo SSO do ecossistema. Interface em inglês, espanhol e português do Brasil.

As decisões, o que a API exige da tela e as armadilhas já pagas estão em [`CLAUDE.md`](CLAUDE.md).

## Rodar

A biblioteca de UI mora no GitHub Packages, privado. Num terminal com `NODE_AUTH_TOKEN` (token clássico
com `read:packages`):

```bash
npm install
npm run dev
```

O Vite atende em `http://localhost:5174` e repassa `/api` para a API do KRLoc em `localhost:3000`. A API
e o SSO precisam estar de pé.

## Conferir

```bash
npm run type-check
npm run lint
npm run check:locales
npm run build
```

## Container

```bash
docker compose up -d --build --wait
```

Sobe o front servido por nginx na 5174, repassando `/api` para a API pela porta da máquina.
