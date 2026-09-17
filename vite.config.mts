import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import Vue from '@vitejs/plugin-vue'
import Fonts from 'unplugin-fonts/vite'
import { defineConfig } from 'vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

/** Onde a API do KRLoc atende em desenvolvimento. O navegador fala so com o Vite. */
const apiTarget = process.env.KRLOC_DEV_PROXY ?? 'http://localhost:3000'

/**
 * Tela de gestao com acao destrutiva nao pode ser embutida em pagina de
 * terceiro: um clique induzido em "Cancelar contrato" e clickjacking comum. O
 * nginx de producao repete os headers.
 */
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': 'frame-ancestors \'none\'',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    Vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    Fonts({
      fontsource: {
        families: [
          {
            name: 'Roboto Mono',
            weights: [400, 700],
          },
          {
            name: 'Roboto',
            weights: [100, 300, 400, 500, 700, 900],
            styles: ['normal', 'italic'],
          },
        ],
      },
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
    // `@pedrolucaslopes/dotlog-ui` declara `vue` e `vuetify` como peer. Duas
    // instancias do Vue quebram `inject`, e e por ele que tema e permissao chegam.
    dedupe: ['vue', 'vuetify'],
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  server: {
    // A porta de APP_BASE_URL no krloc: dela sai a redirect_uri registrada no SSO.
    port: 5174,
    strictPort: true,
    headers: securityHeaders,
    // Mesma origem para front e API: sem CORS, e o cookie SameSite=Strict vale.
    proxy: {
      '/api': { target: apiTarget },
    },
  },
  preview: {
    port: 5174,
    strictPort: true,
    headers: securityHeaders,
    proxy: {
      '/api': { target: apiTarget },
    },
  },
})
