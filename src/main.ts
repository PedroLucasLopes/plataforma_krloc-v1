import { createApp } from 'vue'

import { registerPlugins } from '@/plugins'

import App from './App.vue'

import 'unfonts.css'
import './styles/tailwind.css'
import './styles/main.scss'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')
