# 🚧 KRLoc Plataforma — o front da locação de equipamentos

Front do KRLoc: contratos, equipamentos, acessórios, clientes e obras. Fala com a API do KRLoc na
mesma origem, e a autenticação inteira mora na API, no `@pedrolucaslopes/sso-client`: este front não
conduz OAuth, não guarda token e não tem tela de login. Quem entra passa pela tela de login do IdP,
no console do SSO, e volta para cá.

| Repositório | Papel |
|---|---|
| [`krloc-api-v1`](https://github.com/PedroLucasLopes/krloc-api-v1) | API da locação · NestJS, prefixo `/api`, porta 3000 |
| `plataforma_krloc-v1` (este) | front da locação · Vue 3, Vuetify 4, Pinia · porta 5174 |
| [`sso-api-v1`](https://github.com/PedroLucasLopes/sso-api-v1) | Authorization Server e catálogo RBAC, onde moram rotas, papéis e permissões do projeto KRLoc |
| [`plataforma_sso-v1`](https://github.com/PedroLucasLopes/plataforma_sso-v1) | tela de login do IdP e console do SSO |
| [`components_storybook-v1`](https://github.com/PedroLucasLopes/components_storybook-v1) | `@pedrolucaslopes/dotlog-ui`: componentes, tema e Storybook, instalado pelo npm |

**Todo componente de tela vem de `@pedrolucaslopes/dotlog-ui`.** Componente novo nasce no Storybook,
no repositório da biblioteca, sai numa versão publicada, e só depois é consumido aqui. O que mora
neste projeto é composição com regra de domínio: diálogos, páginas e stores. Foi assim que nasceram
`DlFileDrop`, `DlMoneyField` e `DlLifecycle`, na 0.3.0 da biblioteca.

A revisão de segurança deste front está em [`PENTEST.md`](PENTEST.md).

A interface fala **inglês, espanhol e português do Brasil**, e a pessoa troca pelo menu com o nome dela.
Comentário em português, como no resto do ecossistema. Ver "Traduções".

---

## ⚡ Stack

- **Vue 3.5** (`<script setup>`) · **TypeScript 5.9** · **Vite 8**
- **Vuetify 4** com `vite-plugin-vuetify` (`autoImport`)
- **Pinia 3** em setup stores · **vue-router 5**, rotas declaradas à mão
- **vue-i18n 11**, um JSON por língua
- **Tailwind 4** para layout. Cor, fonte, raio e movimento vêm dos tokens da biblioteca de UI
- **`@pedrolucaslopes/dotlog-ui` pelo npm**, do GitHub Packages. Nada de alias, `paths` ou `../ui`

## 🏃 Comandos

```bash
npm install          # exige NODE_AUTH_TOKEN (read:packages) para baixar a biblioteca de UI
npm run dev          # Vite na 5174, com proxy de /api para localhost:3000
npm run type-check   # vue-tsc
npm run lint:fix
npm run check:locales # as três línguas contra o en.json, e cada chave usada no código
npm run build        # type-check + check:locales + build
```

A API do KRLoc precisa estar de pé na 3000, pelo compose do `krloc-api-v1`, e o SSO na 8080 para entrar.
Para outro endereço da API, `KRLOC_DEV_PROXY=http://host:porta`.

> ⚠️ **A 5174 é disputada.** O container `krloc-plataforma` publica na mesma porta, que é a de
> `APP_BASE_URL` na API e a da `redirect_uri` registrada no projeto KRLoc do SSO. Para rodar o Vite,
> pare o container antes: `docker compose stop krloc-plataforma`.

**Testar mudança da biblioteca antes de publicar.** Na biblioteca, `npm run build` e
`npm pack --pack-destination <pasta fora dos projetos>`; aqui, `npm install --no-save <arquivo .tgz>`.

---

## 🔐 Como a sessão funciona

A API é um **token-mediating backend** (RFC 10017 §6.2), não um BFF, e o front é a interface dela na
mesma origem. O front nunca vê token: o cookie de sessão é `HttpOnly`, cifrado, e vai sozinho com cada
chamada a `/api`.

1. O guard do router chama `GET /api/auth/me`. Com sessão, chegam quem é a pessoa, os papéis, as
   permissões do projeto KRLoc e o token anti-CSRF.
2. Sem sessão, a API responde 401 com `error: "login_required"` e `login_url`. O front troca o
   `returnTo` pela tela pedida e navega para lá. **O `login_url` é absoluto, na origem de
   `APP_BASE_URL`**: quem abriu a tela por outro nome do mesmo host volta ao nome registrado antes de
   entrar, senão o cookie da transação ficaria num host e o callback chegaria em outro.
3. A API conduz o Authorization Code com PKCE, o SSO mostra a tela de login dele, e o callback da API
   devolve um documento que navega de volta à tela pedida.

| Situação | O que o front faz |
|---|---|
| `GET /api/auth/me` responde 401 | manda ao login, voltando para a mesma URL |
| 401 no meio do uso | relogin automático, voltando para a tela onde a pessoa estava |
| API fora do ar | tela `/unavailable`, que só oferece tentar de novo |
| rota sem permissão | tela `/forbidden`; menu, cabeçalho e tabela já escondem o que o papel não alcança |
| 403 do anti-CSRF | relê `GET /api/auth/me` uma vez e repete a chamada: a sessão pode ter sido refeita em outra aba |
| a pessoa saiu | tela `/signed-out`, que **não** manda ao login sozinha |
| o SSO recusou o login | a API devolve a `/sign-in-error?auth_error=<código>`, que mostra o motivo e **não** manda ao login sozinha |

**Sair** é `POST /api/auth/logout`: a API revoga o refresh token no SSO (RFC 7009) e apaga o cookie. A
sessão da pessoa com o SSO continua, e é por isso que a tela de saída espera um clique: mandar ao login
sozinha colocaria a pessoa de volta sem ela pedir.

**Escrita leva `X-CSRF-Token`.** O valor chega em `GET /api/auth/me` e fica só na memória do store.

### O que muda no SSO chega à tela sem novo login

`GET /api/auth/me` era lido uma vez, na carga da página, e papel trocado no SSO só aparecia no menu
depois de sair e entrar. `useSessionWatch`, montado no `AppLayout`, relê a sessão a cada
`SESSION_RECHECK_MS` (30 segundos) com a aba visível, e na volta a ela, por foco ou visibilidade. A
API pergunta ao SSO a cada chamada de `/auth/me` (introspecção, `sso-client` 0.4.0), então a resposta
já traz o papel de agora, e a sessão já sai dali com o token novo.

| O que mudou no SSO | O que a tela faz |
|---|---|
| papel ou rotas do papel | menu, cabeçalho e ações acompanham sozinhos, porque saem de `session.permissions`. Se a tela aberta deixou de ser alcançada, `/forbidden` |
| acesso encerrado: pessoa tirada do projeto, projeto suspenso, grant revogado | vai ao login. Recusada pelo SSO, cai em `/sign-in-error`; ainda liberada, volta sozinha à mesma tela |

Aba escondida não pergunta nada: quem não está olhando não precisa de tela em dia, e a API continua
conferindo cada chamada, com o mesmo prazo.

### Login recusado

Pessoa sem papel no projeto KRLoc entra no SSO, e o SSO devolve `access_denied` ao callback da API
(RFC 6749 §4.1.2.1). Com `APP_LOGIN_ERROR_REDIRECT=/sign-in-error` no ambiente da API, o `sso-client`
manda a pessoa de volta a esta tela com `?auth_error=<código>` e, quando se sabe para onde ela ia,
`&returnTo=<caminho>`. **Sem a variável, o callback responde JSON, e é esse JSON que a pessoa vê.**

- **O cartão é o da tela de login do SSO**, o `DlSignIn`, com a marca do KRLoc: nome, escavadeira e a
  mesma caixa de erro.
- **Só código conhecido vira texto.** `signInError`, em `constants/messages.ts`, aceita os cinco de
  `SsoLoginErrorCode` (`access_denied`, `login_expired`, `state_mismatch`, `sso_unavailable`,
  `login_failed`); o resto, e a falta de código, é a falha genérica. Nada lido da URL é ecoado.
- **A tela é pública e não manda ao login sozinha.** Com guard, a conta recusada iria ao login, seria
  recusada de novo e voltaria para cá num laço sem clique. "Continuar com SSO" é o clique, para depois de
  um administrador liberar o acesso, e volta ao `returnTo`, que passa por `safeReturnPath` de novo.
- **Quem já tem sessão e abre a tela**, como num favorito, vai direto ao `returnTo`. `GET /api/auth/me`
  não manda ao login no 401, então a conferência não vira laço.

---

## 🗣️ Traduções

Todo texto de tela mora em `src/locales`: `en.json` (referência), `es.json`, `pt-BR.json`. Mesmo modelo
do console do SSO:

- **Língua nova é só um JSON.** `plugins/i18n.ts` registra todo arquivo da pasta, e o `DlUserMenu` lista a
  língua com o nome nela mesma e a bandeira.
- **No componente,** `const { t } = useI18n()`. **Fora dele,** o `t` de `@/plugins/i18n`.
- **Rótulo que depende da língua é lido na hora de desenhar:** `computed`, template ou getter. As pastilhas
  de `constants/status.ts` têm o rótulo num getter.
- **Mensagem da API** é traduzida por `API_MESSAGE_KEYS` (texto exato → chave) e por padrões para as que
  trazem valor dentro ("Equipment type mismatch: cannot replace X with Y"). Validação desconhecida do
  class-validator entra como detalhe de `errors.status.badRequest`.
- **Plural** é do vue-i18n. Com três formas, a primeira é o zero: `"Hoje | Amanhã | Em {count} dias"`.
- **`@` literal é `{'@'}`.**

**`Lessee` é "obra".** No banco o nome é locatário, mas é o lugar para onde o equipamento vai, com
endereço próprio, e cada cliente tem várias. Em inglês, "job site".

**Dinheiro é sempre em reais**, com a pontuação da língua da tela: `CURRENCY`, em `constants/api.ts`, é
fato do negócio. Campo de valor usa `DlMoneyField`, nunca `type="number"`.

`npm run check:locales` roda dentro do `npm run build`.

⚠️ **Namespace de tradução não pode ter nome de palavra que aparece com ponto no código.** O conferidor
lê toda string entre aspas simples ou crase com cara de chave: um namespace `import` fazia o comentário
`` `import.meta.glob` `` virar "chave que não existe". Por isso a importação de planilha é `spreadsheet`.

---

## 🧭 Telas

| Rota | Permissão | O que tem |
|---|---|---|
| `/` | nenhuma | painel: contratos ativos, vencendo e esperando começar, frota por situação, contratos por mês |
| `/contracts` | `GET /elease` | contratos, filtro por situação (na URL) e por equipamento |
| `/contracts/:id` | `GET /elease/:id` | o ciclo do contrato e tudo o que se faz com ele |
| `/equipment` | `GET /equipment` | unidades, busca por nome ou código (texto com `KR` busca pelo código), situação na URL |
| `/equipment/:id` | `GET /equipment/:id` | identificação, tabela de preços, acessórios associados |
| `/accessories` | `GET /accessory` | acessórios e estoque |
| `/clients` · `/clients/:id` | `GET /client` · `GET /client/:id` | clientes, ficha e as obras do cliente |
| `/lessees` · `/lessees/:id` | `GET /lessee` · `GET /lessee/:id` | obras, ficha e contratos da obra |
| `/signed-out` · `/unavailable` · `/sign-in-error` | pública | saída, API fora do ar e login recusado |

O menu sai das permissões por `deriveNavGroups`; `constants/navigation.ts` só dá rótulo, ícone, grupo e rota.

**O painel não deixa buraco.** Cartões e gráficos são flex, com `flex: 1 1 <piso>` e `min-width: 0`:
cabem quantos a largura permitir, e quem sobra na última linha cresce até a borda. A grade
`repeat(auto-fit, minmax(...))` mantinha a largura das colunas na última linha, e cinco cartões em
quatro colunas deixavam o quinto sozinho. O piso dos cartões é `STAT_CARD_MIN_WIDTH`, 170px, que põe
os cinco numa linha com 960px de conteúdo.

## 📄 O contrato

`DlLifecycle` mostra `Pendente › Ativo › Concluído`, com `Cancelado` como saída. Embaixo do ciclo, uma
frase diz o que falta. Cada situação oferece só o que a API aceita nela, e só com a permissão da rota:

| Situação | Ações |
|---|---|
| `PENDING` | gerar o documento do contrato, adicionar e tirar equipamento, cancelar; **começar só aparece com o documento gerado** |
| `ACTIVE` | registrar a volta de cada equipamento (bom estado, manutenção, roubo), substituir o que voltou para manutenção ou foi roubado, relatório financeiro do período, fechar |
| `COMPLETED` | documento de fechamento |

- **A volta é a ação principal da linha.** Redonda, preenchida com a cor primária e com
  `mdi-truck-check-outline`, pelo `primary` do `RowAction` (`dotlog-ui` 0.5.0). As outras ações da
  linha continuam discretas. Trocar o ícone é uma linha em `ContractDetailPage.vue`.
- **O preço do item é o congelado no contrato**, nunca o do equipamento.
- **Substituir** só oferece unidade disponível do mesmo código, outra unidade, com o mesmo número de
  acessórios: as três regras da API.
- **Fechar** com equipamento sem volta devolve 400 com os itens; a mensagem do modal cita os códigos.
- **Documento** é `POST` que devolve `.docx`; o nome vem do `Content-Disposition`.

---

## 📁 Estrutura

```bash
💻 src/
├─ 🧭 router/        # rotas, guard de sessão e de permissão, barra de carregamento
├─ 🧱 layouts/       # AppLayout (DlAppShell) · GateLayout (saída, API fora do ar)
├─ 📄 pages/         # Dashboard, SignedOut, Unavailable, SignInError, contracts/, equipment/, accessories/, clients/, lessees/
├─ 🧩 components/    # diálogos de cadastro, AddressFields (CEP), ImportDialog · contract/ (ações do contrato)
├─ 🗃️ stores/        # session, preferences, lookups, equipment, accessories, clients, lessees, contracts
├─ 🔌 services/      # http.ts (erro, CSRF, 401, 404 vazio, download) · krloc.ts (endpoints) · zipcode.ts
├─ 🗣️ locales/       # en.json (referência), es.json, pt-BR.json
├─ 🔧 plugins/       # i18n.ts · vuetify.ts
├─ 🎨 constants/     # api, layout, navigation, status (pastilhas e ciclo), messages (API → chaves), theme
├─ 🧰 composables/   # useForm (modal que se abre sozinho) · useConfirm · useSessionWatch (relê a sessão)
├─ 🔤 types/         # krloc.ts, espelho do que a API devolve
└─ 🛠️ utils/         # format (data, dinheiro, unidade) · documents (CPF, CNPJ, CEP) · address · forms · files
```

**A marca do KRLoc é a escavadeira.** `APP_LOGO`, em `constants/layout.ts`, vai ao topo do menu pelo
`logo` do `DlAppShell`, e `public/favicon.svg` desenha o mesmo ícone na aba. Sem `logo`, a biblioteca
mostra um ícone neutro, nunca a marca de outra aplicação. Arquivo estático não lê constante nem token:
ele repete à mão o desenho, o `primary` e o `onPrimary` da biblioteca, com a versão escura por
`prefers-color-scheme`. Mudou a marca ou a paleta, mude o ícone da aba junto.

## 🗃️ Estado

- **`session`**: quem entrou, permissões, token anti-CSRF, login, saída e relogin.
- **`lookups`**: cada recurso inteiro até `LOOKUP_LIMIT`, para painel e seletores. O painel busca de novo a
  cada visita; o diálogo de contrato busca os equipamentos de novo a cada abertura, porque disponibilidade
  muda a todo momento.
- **Um store por recurso** com a lista paginada no servidor e o registro aberto. Toda escrita relê o que
  está na tela, em vez de remendar estado local.

## 🔌 O backend que a tela precisa conhecer

| Comportamento da API | Onde é tratado |
|---|---|
| Listagem vazia responde 404 | `request(..., { emptyOn404: true })` devolve `[]` |
| Não há total de registros; `limit` tem piso 10 e não tem teto | paginação cega, `PAGE_SIZE = 20`, `LOOKUP_LIMIT = 500` |
| `GET /accessory` ignora filtro e página (controller sem `@Query()`) | a lista mostra os 10 primeiros; a busca por nome não filtra até a API ser corrigida |
| Filtro de cliente por CPF ou CNPJ quebra na API | a busca de clientes vai só por nome e por e-mail completo |
| CNPJ só é aceito sem pontuação | `normalizeTaxId` limpa antes de enviar; CPF e CNPJ conferidos pelo dígito antes |
| Endereço é conferido contra a base de CEP | `AddressFields` consulta a mesma base e trava o que ela preencheu |
| Na edição, a API confere o endereço enviado contra o endereço **antigo** | edição manda só CEP e número; a API busca o resto pelo CEP |
| CEP sem logradouro grava a rua vazia (`??` em vez de `\|\|`) | limitação conhecida: a rua digitada não fica |
| Datas de contrato têm dia, não hora | o front manda meio-dia local, que cai no mesmo dia em qualquer fuso |
| Começar exige `contract_generated` | "Começar contrato" só aparece depois de gerar o documento |
| Cancelar recusa contrato com equipamento | a recusa aparece dentro do modal; hoje nenhum contrato com equipamento cancela |
| Apagar obra sempre recusa; mandar o cliente na edição da obra sempre recusa | a recusa aparece no modal; a edição não manda o cliente, que fica travado |
| A volta exige equipamento `LEASED`; substituto nasce `REPLACE` | substituto não registra volta, e contrato com substituição não fecha |
| Desativar equipamento reservado ou substituto a API aceita | a tela esconde o botão: o contrato ficaria sem o equipamento |
| Remover acessório com estoque tira uma unidade; sem estoque, apaga | o modal diz qual dos dois vai acontecer |
| Mensagens de erro em inglês, algumas com valor dentro | `API_MESSAGE_KEYS` e `API_MESSAGE_PATTERNS`, em `constants/messages.ts` |
| Upload até 2 MB | `DlFileDrop` recusa antes; o nginx aceita até 3 MB, acima do padrão de 1 MB |

A consulta de CEP é a **única chamada que sai da origem**: vai à mesma base que a API usa, só com o CEP,
sem cookie e sem `Referer`.

---

## 🐳 Container

`docker compose up -d --build`, na raiz deste repositório e num terminal com `NODE_AUTH_TOKEN`, sobe só o
front. A biblioteca de UI chega pelo `npm ci`, do GitHub Packages, com o token como **secret do BuildKit**.

O nginx é um template. `KRLOC_UPSTREAM`, que no compose é `http://host.docker.internal:3000`, liga o
repasse de `/api` para a API, o mesmo papel do proxy do Vite. Vazio, `/api` responde 404, que é o caso de
produção. A porta da máquina muda com `KRLOC_PLATAFORMA_PORT`; mudou, mude junto `APP_BASE_URL` na API e a
`redirect_uri` do projeto KRLoc no SSO.

## 🚨 Armadilhas já pagas

⚠️ **O CSS dos componentes `Dl*` não vem sozinho.** Ele entra por `import '@pedrolucaslopes/dotlog-ui/styles'`,
em `plugins/vuetify.ts`, depois de `vuetify/styles`. Sem essa linha tudo aparece sem forma, sem erro.

⚠️ **O nginx não lê o `/etc/hosts`.** Com `proxy_pass` montado de variável, o nome é resolvido no DNS do
Docker, `resolver 127.0.0.11`. Em Docker Engine no Linux, use o IP do host.

⚠️ **`add_header` num `location` descarta os herdados do `server`.** Todo `location` que declara header
repete os de segurança.

⚠️ **O `.env.docker` da API é quem vale no container.** Chave de cliente nova precisa entrar nele também,
não só no `.env` do `start:dev`: com a chave revogada o SSO recusa a troca do code
(`invalid_client: asserção de cliente invalida`) e ninguém entra.

⚠️ **A base de CEP responde 200 com `"erro": "true"`**, em texto, para CEP que não existe.
`services/zipcode.ts` aceita os dois formatos.

⚠️ **Verificação com o painel do navegador oculto engana.** Sem pintura, `requestAnimationFrame` e as
transições param: a troca de página fica presa na tela anterior e o gráfico no esqueleto. Confira o DOM.

⚠️ **Os temas se chamam `dotlogLight` e `dotlogDark`**, e **`lib` fica em ES2023**: o ESLint exige
`toSorted`.

## ✅ Invariantes ao alterar

- Componente de tela vem de `@pedrolucaslopes/dotlog-ui`, pelo npm. Componente novo nasce lá, com story
  nos dois temas, e chega aqui por versão publicada.
- Nenhum token, chave ou segredo em store, `localStorage`, log ou URL. O front não tem `.env`.
- Texto de tela vai para `src/locales`, nas três línguas, e sai por `t()`.
- Toda escrita passa por `services/http.ts`, que anexa o `X-CSRF-Token`.
- A tela de login recusado só mostra texto de código conhecido, fica fora do guard e não manda ao login
  sozinha.
- `useSessionWatch` fica montado no `AppLayout`. Sem ele, papel trocado no SSO só chega ao menu
  depois de sair e entrar.
- Tela nova declara `meta.permission` com o mesmo método e caminho do catálogo do projeto KRLoc no SSO.
- Ação que o papel não alcança sai do DOM; desabilitar fica para bloqueio por estado.
- Preço de contrato vem do item do contrato, nunca do equipamento.
- Dinheiro entra por `DlMoneyField` e sai por `formatMoney`, sempre em `CURRENCY`.
- A tela não oferece o que a API recusa na situação do registro.
- Rode `npm run type-check`, `npm run lint` e `npm run check:locales` antes de considerar pronto.
