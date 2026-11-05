import { lazy } from 'react';

// Cada tela vira um arquivo separado: o Login e a primeira tela abrem sem esperar o código
// do sistema inteiro. Depois que o sistema abre, preCarregarTelas() baixa as demais em segundo
// plano; sem isso, o primeiro clique em cada tela ficava parado enquanto o arquivo descia.
const carregadores: Array<() => Promise<unknown>> = [];
export const tela: typeof lazy = (carregar) => {
  carregadores.push(carregar);
  return lazy(carregar);
};

let preCarregou = false;
export function preCarregarTelas() {
  if (preCarregou) return;
  preCarregou = true;
  const agendar = (fn: () => void) =>
    'requestIdleCallback' in window ? window.requestIdleCallback(fn) : setTimeout(fn, 1500);
  // Uma por vez, para não disputar a rede com as chamadas da tela que está abrindo.
  agendar(async () => {
    for (const carregar of carregadores) {
      try {
        await carregar();
      } catch {
        // Falhou (rede, deploy novo): a tela é baixada normalmente quando o usuário abrir.
      }
    }
  });
}
