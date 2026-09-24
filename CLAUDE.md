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
Ver "Traduções". **O código não leva comentário**: nome de variável, função e tipo em inglês, e o que
precisa de explicação mora no `CLAUDE.md` do repositório.

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
- **Erro da API é traduzido pelo código**, no campo `error`: `ERROR_CODES`, em `constants/messages.ts`,
  lista os que a tela conhece, e o texto mora em `errors.code.<código>`. A recusa da validação traz o
  código de cada campo, com texto em `errors.field.<código>`. Código desconhecido cai na mensagem do
  status, e o `message` do servidor **nunca** vai para a tela. Valor dentro do texto, como o status em
  `contract_in_state`, vem de um membro próprio do corpo, nunca da frase.
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
| `/equipment/:id` | `GET /equipment/:id` | identificação, tabela de preços, acessórios associados. Desativada, a unidade só oferece reativar |
| `/accessories` | `GET /accessory` | acessórios e estoque, busca por nome |
| `/clients` · `/clients/:id` | `GET /client` · `GET /client/:id` | clientes, busca por nome, e-mail completo, CPF ou CNPJ, ficha e as obras do cliente |
| `/lessees` · `/lessees/:id` | `GET /lessee` · `GET /lessee/:id` | obras, ficha e contratos da obra |
| `/financial` | `GET /finantial` | fechamento do mês: cartões, abas de fechados, ativos, na obra, manutenções e roubos, e o documento do mês. O mês fica na URL |
| `/financial/calculator` | `POST /finantial/simulate` | calculadora de contrato: equipamentos, período contratado e a devolução e a ocorrência de cada equipamento |
| `/signed-out` · `/unavailable` · `/sign-in-error` | pública | saída, API fora do ar e login recusado |

O menu sai das permissões por `deriveNavGroups`; `constants/navigation.ts` só dá rótulo, ícone, grupo e rota.
A calculadora é `POST`, que o `deriveNavGroups` não transforma em item: ela entra no grupo Financeiro a mão,
com a permissão dela.

## 💰 Financeiro

**A conta é toda da API**, pelas cláusulas do contrato de locação: a tela escreve o que chega e nunca
refaz regra. O `CLAUDE.md` do `krloc-api-v1` tem a regra, cláusula por cláusula.

- **`StatementBreakdown`** desenha um extrato: os totais em cartões e, por posição (o equipamento com os
  substitutos dele), as linhas com a cláusula que manda cada uma. Serve ao contrato e à calculadora.
- **No contrato**, a seção Financeiro lê `GET /finantial/:id` e relê a cada ação: pendente mostra o
  contratado; ativo, o que correu até hoje; concluído, o extrato gravado no fechamento.
- **Na calculadora, cada equipamento volta no próprio dia.** A devolução nasce no término contratado e o
  segue enquanto a pessoa não a trocar; com defeito ou roubo sem substituto, a unidade sai da obra na
  ocorrência. A última simulação fica no store, e volta ao abrir a tela de novo.
- **Equipamento sem diária na tabela** sai com a conta zerada e um aviso: a API marca `missingPrice`.

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
| `ACTIVE` | registrar a volta de cada equipamento, substituto inclusive (bom estado, manutenção, roubo), substituir o que voltou para manutenção ou foi roubado, baixar o extrato, fechar |
| `COMPLETED` | documento de fechamento (a baixa da cláusula 10ª) |

- **Substituível** é o item que voltou para manutenção ou foi roubado e ainda não tem substituto: o
  substituto aponta para ele por `replacesItemId`. O substituto que quebrar também pode ser trocado.

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
├─ 📄 pages/         # Dashboard, SignedOut, Unavailable, SignInError, contracts/, equipment/, accessories/, clients/, lessees/, financial/
├─ 🧩 components/    # diálogos de cadastro, AddressFields (CEP), ImportDialog · contract/ (ações do contrato) · financial/ (extrato)
├─ 🗃️ stores/        # session, preferences, lookups, equipment, accessories, clients, lessees, contracts, financial
├─ 🔌 services/      # http.ts (erro, CSRF, 401, 404 vazio, download) · krloc.ts (endpoints) · zipcode.ts
├─ 🗣️ locales/       # en.json (referência), es.json, pt-BR.json
├─ 🔧 plugins/       # i18n.ts · vuetify.ts
├─ 🎨 constants/     # api, layout, navigation, status (pastilhas e ciclo), messages (códigos → chaves), theme
├─ 🧰 composables/   # useForm (modal que se abre sozinho) · useConfirm · useSessionWatch (relê a sessão)
├─ 🔤 types/         # krloc.ts, espelho do que a API devolve
└─ 🛠️ utils/         # format (data, dinheiro, unidade) · months (fechamento) · documents (CPF, CNPJ, CEP) · address · forms · files
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
| Não há total de registros; `limit` tem piso 10 e teto 500 (`MAX_LIMIT`) | paginação cega, `PAGE_SIZE = 20`. As consultas de apoio pedem o teto, `LOOKUP_LIMIT = 500`, e o painel mostra "500+" quando chega nele |
| Busca de cliente: `name` e `taxId` aceitam trecho; `email`, só o endereço completo (`@IsEmail()`) | uma caixa só, em `stores/clients.ts`: e-mail vai como `email`; dígitos com a pontuação do documento, ou um CPF ou CNPJ inteiro que confere, vão limpos como `taxId`; o resto, como `name` |
| CNPJ só é aceito sem pontuação, e o `tax_id` é gravado como chega | `normalizeTaxId` limpa antes de enviar, o CNPJ alfanumérico inclusive, e a busca por documento procura nesse formato; CPF e CNPJ conferidos pelo dígito antes |
| O filtro de contrato por equipamento olha o equipamento ainda ligado ao contrato (`Equipment.eleaseId`), não os itens | limitação conhecida: contrato concluído ou cancelado, e o equipamento que já voltou, não aparecem nessa busca |
| Endereço é conferido contra a base de CEP: o que ela tem vence, e o que ela deixa vazio, como a rua de CEP geral de cidade, vem do corpo. Sem rua nenhuma, `address_required` | `AddressFields` consulta a mesma base, no cadastro e na edição, trava o que ela preencheu e pede a rua que ela não tem |
| Na edição, a API só consulta a base quando o CEP muda ou chega campo de endereço, e confere contra a base, nunca contra o gravado. Com CEP novo, o endereço gravado não vale mais | `addressInput` manda o que mudou; com CEP novo, o endereço inteiro do formulário. Ao abrir a edição, a tela pergunta à base pelo CEP gravado e destrava o que ela não preenche |
| Datas de contrato têm dia, não hora; cobrança e documentos contam o dia de São Paulo | o front manda meio-dia local, que cai no mesmo dia de São Paulo de −12h a +9h, o Brasil inteiro incluído |
| Começar exige `contract_generated` | "Começar contrato" só aparece depois de gerar o documento |
| Cancelar só vale em `PENDING`, e com todo equipamento ainda reservado; senão, `contract_equipment_not_reserved` | "Cancelar" só aparece no pendente, e a recusa aparece dentro do modal |
| Obra com contrato, até encerrado, não se apaga (`lessee_has_contracts`) | "Apagar" só aparece para obra sem contrato |
| Obra não troca de cliente: o atual passa, outro é recusado (`lessee_owner_change`) | a edição trava o cliente e não o manda, porque não há o que mudar |
| A volta aceita `LEASED` e `REPLACE`; substituto nasce `REPLACE` e aponta para o item que substitui | a volta vale para os dois; substituível é quem ainda não tem `replacedBy` |
| A cobrança é por equipamento, até a volta de cada um | a tela não refaz conta: lê `GET /finantial/:id` e a calculadora |
| Editar e desativar equipamento reservado, locado ou substituto é recusado (`equipment_leased`): só o contrato o muda | a tela esconde as duas ações nessas situações |
| Desativar é baixa: o desativado não se edita (`equipment_retired`) e só volta por `POST /equipment/reactivate/:id`, que o devolve disponível e recusa quem não está desativado (`equipment_not_retired`) | "Reativar" é a única ação da unidade desativada, e entra na tabela quando há alguma na página |
| O cadastro de equipamento só grava `AVAILABLE`, `MAINTENANCE` e `STOLEN`; sem `status` no corpo, a edição mantém a situação gravada | o seletor oferece as três, e o formulário manda a escolhida |
| Remover acessório com estoque tira uma unidade; sem estoque, apaga | o modal diz qual dos dois vai acontecer |
| Erro sai com código em `error`, e valor em membro próprio | `apiErrorText`, em `constants/messages.ts`: código conhecido vira texto, o resto cai no status |
| Upload até 2 MB | `DlFileDrop` recusa antes; o nginx aceita até 3 MB, acima do padrão de 1 MB |

A consulta de CEP é a **única chamada que sai da origem**: vai à mesma base que a API usa, só com o CEP,
sem cookie e sem `Referer`.

---

## 🚀 CI/CD

`.github/workflows/ci.yml`, no GitHub Actions:

| Quando | O que roda |
|---|---|
| pull request e push na `main` | `npm ci`, `npm audit` (produção sem aviso nenhum; o resto, sem alto), lint e build, que roda o type-check e confere as traduções |
| pull request | a imagem é montada, sem publicar |
| push na `main`, tag `v*` e à mão | a imagem do front, o nginx com o build, vai para o GitHub Container Registry, `ghcr.io/pedrolucaslopes/plataforma_krloc-v1`, com a tag do commit, `main` e a versão, proveniência e SBOM |

- **O pacote privado.** O `npm ci` e o build da imagem leem `@pedrolucaslopes/dotlog-ui` com o `GITHUB_TOKEN` da
  execução, quando o pacote libera leitura a este repositório (nas configurações do pacote, "Manage
  Actions access"), ou com o secret `PACKAGES_READ_TOKEN`, um token clássico com `read:packages`. Sem um
  dos dois, o `npm ci` do pipeline responde 403.
- **O pipeline é superfície de ataque.** Actions fixadas por commit, `permissions: {}` no topo e o
  mínimo por job, checkout sem credencial persistida, sem `pull_request_target`, e o token do npm como
  secret do BuildKit. O Dependabot (`.github/dependabot.yml`) abre pull request para as actions e a
  imagem base toda semana; o npm fica de fora, porque o pacote privado pede um token próprio dele.
- **O deploy ainda não existe.** A imagem publicada é o artefato. O alvo é o Firebase Hosting, com os
  rewrites de `/api` e `/sso` numa origem só, e entra quando houver o projeto no GCP.

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

⚠️ **`defineModel` com `v-model` do pai só relê o valor quando o pai redesenha.** Duas atribuições na
mesma volta partem as duas do valor antigo, e a segunda desfaz a primeira. Era o que trazia de volta o
CEP antigo quando um CEP novo chegava de uma vez, colado, sobre endereço travado: a cidade vinha do CEP
novo e o CEP ficava o velho. `AddressFields` monta o endereço numa atribuição só.

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
- Texto de erro sai do código em `error`, ou do status. O `message` do servidor nunca vai para a tela, e
  a repetição depois do anti-CSRF depende do código `csrf_token_invalid`, não da frase.
- A tela de login recusado só mostra texto de código conhecido, fica fora do guard e não manda ao login
  sozinha.
- `useSessionWatch` fica montado no `AppLayout`. Sem ele, papel trocado no SSO só chega ao menu
  depois de sair e entrar.
- Tela nova declara `meta.permission` com o mesmo método e caminho do catálogo do projeto KRLoc no SSO.
- Ação que o papel não alcança sai do DOM; desabilitar fica para bloqueio por estado.
- Preço de contrato vem do item do contrato, nunca do equipamento.
- Valor cobrado vem da API: extrato, fechamento e calculadora. A tela não refaz regra de cobrança.
- Dinheiro entra por `DlMoneyField` e sai por `formatMoney`, sempre em `CURRENCY`.
- A tela não oferece o que a API recusa na situação do registro.
- Rode `npm run type-check`, `npm run lint` e `npm run check:locales` antes de considerar pronto.
