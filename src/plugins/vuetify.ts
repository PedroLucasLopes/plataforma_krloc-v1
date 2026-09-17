/**
 * plugins/vuetify.ts
 *
 * O tema e o do ecossistema, vindo de `@pedrolucaslopes/dotlog-ui`: os mesmos
 * tokens que o Storybook mostra e que passaram pela conferencia de contraste.
 * Nenhuma cor e definida aqui.
 *
 * A lingua e a do vue-i18n do KRLoc. `createDotlogLocale` liga o Vuetify e os
 * componentes da biblioteca a ela: trocar no menu do usuario troca tudo junto.
 *
 * O CSS dos componentes `Dl*` vem compilado no pacote e entra depois do
 * `vuetify/styles`, para ganhar onde os dois disputam.
 */

import { createDotlogLocale, vuetifyOptions } from '@pedrolucaslopes/dotlog-ui'
import { useI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'
import { i18n } from './i18n'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import '@pedrolucaslopes/dotlog-ui/styles'

// ⚠️ NAO desligue `theme.utilities`. As classes geradas (`text-success`,
// `bg-primary`) sao o mecanismo que aplica a prop `color` de QUALQUER
// componente do Vuetify. Sem elas o componente recebe a classe, a variavel do
// tema existe, e nada acontece: chip de erro sai cinza, botao destrutivo sai
// neutro, e o sintoma nao aponta para a causa.
export default createVuetify({ ...vuetifyOptions, locale: createDotlogLocale({ i18n, useI18n }) })
