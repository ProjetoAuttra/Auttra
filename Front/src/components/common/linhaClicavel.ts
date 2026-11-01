import type * as React from "react";

// Elementos interativos dentro da linha (menu ⋮, botões de ação, links) têm ação própria.
const INTERATIVO = 'button, a, input, select, textarea, label, [role="button"], [role="menuitem"], [role="checkbox"]';

function vemDeElementoInterativo(e: React.SyntheticEvent<HTMLElement>) {
  const alvo = e.target as HTMLElement | null;
  const interativo = alvo?.closest?.(INTERATIVO);
  return !!interativo && interativo !== e.currentTarget && e.currentTarget.contains(interativo);
}

/**
 * Props para uma linha de tabela que abre um registro: um clique ou Enter/Espaço abre.
 * Ignora cliques em botões dentro da linha e não navega quando o usuário está selecionando
 * texto (para copiar telefone, placa etc.).
 */
export function linhaClicavel(abrir: () => void) {
  return {
    hover: true,
    tabIndex: 0,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (vemDeElementoInterativo(e)) return;
      if (window.getSelection?.()?.toString()) return;
      abrir();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    },
  };
}

/**
 * Props para um elemento que não é <button> mas age como botão (cartão, avatar, área de upload):
 * ganha foco pelo Tab, papel de botão para leitor de tela e responde a Enter/Espaço.
 */
export function comoBotao(acao: (e: React.SyntheticEvent<HTMLElement>) => void) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: (e: React.MouseEvent<HTMLElement>) => acao(e),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        acao(e);
      }
    },
  };
}
