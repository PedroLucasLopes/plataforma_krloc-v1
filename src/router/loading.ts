import { ref } from 'vue'

/**
 * Troca de tela em andamento. A casca mostra a barra do topo enquanto isto for
 * verdadeiro; o `DlLoader` so a desenha se a espera passar do limiar dele.
 */
export const routeLoading = ref(false)
