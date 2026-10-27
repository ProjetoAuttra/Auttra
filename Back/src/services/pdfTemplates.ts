import { escapeHtml as esc } from "../utils/escapeHtml.js";

/**
 * Layout comum dos PDFs (orçamento e ordem de serviço): cabeçalho com a identidade da oficina,
 * blocos de dados, tabela de itens, totais e assinaturas. Todo texto vindo do banco passa por esc().
 */

type Num = { toNumber?: () => number } | number | string | null | undefined;

export function dinheiro(v: Num) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : v?.toNumber?.() ?? 0;
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Datas só-dia (vencimento, validade) ficam em UTC; instantes (abertura, conclusão) usam o fuso de Brasília. */
export function dataBr(d: Date | string | null | undefined, instante = false) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: instante ? "America/Sao_Paulo" : "UTC" }) : "";
}

export type OficinaPdf = {
  nome: string;
  cnpj?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  cor_principal?: string | null;
  cidade?: { nome: string; uf: string } | null;
  financeiro_config?: unknown;
};

/** O PDF não faz requisições de rede: só logos embutidas (data URI) de imagem raster aparecem. */
function logoSegura(url?: string | null) {
  return url && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url) ? url : null;
}

export function formasPagamento(oficina: OficinaPdf): string | null {
  const cfg = oficina.financeiro_config as { formasPagamento?: unknown } | null | undefined;
  return typeof cfg?.formasPagamento === "string" && cfg.formasPagamento.trim() ? cfg.formasPagamento.trim() : null;
}

export const COR_PADRAO = "#1e3a8a";

/** Só aceita #RRGGBB; qualquer outra coisa cai na cor padrão (o valor entra direto no CSS). */
export function corValida(cor?: string | null) {
  return cor && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor.toLowerCase() : COR_PADRAO;
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/** Luminância relativa (WCAG), de 0 (preto) a 1 (branco). */
function luminancia(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Deriva a paleta do documento a partir da cor da oficina: a cor principal em faixas e totais,
 * uma versão escurecida para textos (sempre legível sobre branco) e texto claro/escuro sobre a cor.
 */
export function paleta(corPrincipal?: string | null) {
  const principal = corValida(corPrincipal);
  const base = rgb(principal);
  // Cores claras demais perdem contraste como texto sobre branco: escurece até ter contraste mínimo.
  let escura = principal;
  for (let f = 0.9; luminancia(escura) > 0.18 && f > 0.2; f -= 0.1) escura = toHex(base.map((v) => v * f));
  return {
    principal,
    escura,
    sobrePrincipal: luminancia(principal) > 0.45 ? "#111827" : "#ffffff",
    suave: toHex(base.map((v) => 255 - (255 - v) * 0.12)),
  };
}

const css = (cor?: string | null) => {
  const p = paleta(cor);
  return `
  :root { --cor: ${p.principal}; --cor-escura: ${p.escura}; --sobre-cor: ${p.sobrePrincipal}; --cor-suave: ${p.suave}; }
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif; font-size: 12px; line-height: 1.45; color: #1f2937; }
  h1, h2, h3, p { margin: 0; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 14px; border-bottom: 2px solid var(--cor); }
  .oficina { display: flex; gap: 12px; align-items: flex-start; max-width: 60%; }
  .oficina img { width: 56px; height: 56px; object-fit: contain; }
  .oficina .nome { font-size: 16px; font-weight: 700; color: #111827; }
  .oficina .linha { color: #6b7280; font-size: 11px; }
  .doc { text-align: right; }
  .doc .tipo { font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #6b7280; }
  .doc .numero { font-size: 24px; font-weight: 700; color: var(--cor-escura); line-height: 1.15; }
  .doc .meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
  .status { display: inline-block; margin-top: 6px; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; background: #e5e7eb; color: #374151; }
  .status.ok { background: #dcfce7; color: #166534; }
  .status.aviso { background: #fef3c7; color: #92400e; }
  .status.erro { background: #fee2e2; color: #991b1b; }
  .status.info { background: var(--cor-suave); color: var(--cor-escura); }
  .colunas { display: grid; gap: 28px; margin-top: 18px; }
  .colunas.c2 { grid-template-columns: 1fr 1fr; }
  .colunas.c3 { grid-template-columns: 1fr 1fr 1fr; }
  .bloco h3 { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; padding-bottom: 4px; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  .bloco .principal { font-size: 13px; font-weight: 700; color: #111827; }
  .bloco p { margin-top: 1px; }
  .secao { margin-top: 20px; break-inside: avoid; }
  .secao > h3 { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-size: 10px; letter-spacing: .8px; text-transform: uppercase; color: #6b7280; padding: 6px 8px; border-bottom: 1.5px solid var(--cor); }
  tbody td { padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr { break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  .tipo-item { display: block; font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .6px; }
  .vazio { text-align: center; color: #9ca3af; padding: 14px 8px; }
  .totais { margin-top: 10px; margin-left: auto; width: 260px; break-inside: avoid; }
  .totais .linha { display: flex; justify-content: space-between; padding: 3px 8px; color: #4b5563; }
  .totais .total { margin-top: 4px; padding: 9px 8px; background: var(--cor); color: var(--sobre-cor); border-radius: 4px; font-size: 15px; font-weight: 700; }
  .caixa { border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px; background: #f9fafb; white-space: pre-wrap; }
  .condicoes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .condicoes .item .rotulo { font-size: 10px; letter-spacing: .8px; text-transform: uppercase; color: #6b7280; }
  .condicoes .item .valor { font-weight: 600; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px; break-inside: avoid; }
  .assinaturas .linha-ass { border-top: 1px solid #6b7280; padding-top: 4px; text-align: center; font-size: 10px; color: #6b7280; }
  .destaque { margin-top: 22px; padding: 16px 18px; border-left: 4px solid var(--cor); background: var(--cor-suave); border-radius: 0 4px 4px 0; break-inside: avoid; }
  .destaque .frase { font-size: 13px; color: #374151; }
  .destaque .valor { font-size: 28px; font-weight: 700; color: var(--cor-escura); line-height: 1.2; margin-top: 2px; }
  .destaque .extenso { font-size: 11px; color: #6b7280; margin-top: 2px; }
  footer { margin-top: 28px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
`;
};

function enderecoOficina(o: OficinaPdf) {
  const rua = [o.logradouro, o.numero].filter(Boolean).join(", ");
  const compl = o.complemento ? ` - ${o.complemento}` : "";
  const cidade = o.cidade ? `${o.cidade.nome}/${o.cidade.uf}` : "";
  return [rua + compl, cidade, o.cep ? `CEP ${o.cep}` : ""].filter((p) => p.trim()).join(" · ");
}

export function cabecalho(oficina: OficinaPdf, doc: { tipo: string; numero: number; status?: { label: string; classe?: string }; meta?: string[] }) {
  const logo = logoSegura(oficina.logo_url);
  const contato = [oficina.telefone, oficina.email].filter(Boolean).join(" · ");
  return `
    <div class="topo">
      <div class="oficina">
        ${logo ? `<img src="${esc(logo)}" alt="" />` : ""}
        <div>
          <div class="nome">${esc(oficina.nome)}</div>
          ${oficina.cnpj ? `<div class="linha">CNPJ ${esc(oficina.cnpj)}</div>` : ""}
          <div class="linha">${esc(enderecoOficina(oficina))}</div>
          ${contato ? `<div class="linha">${esc(contato)}</div>` : ""}
        </div>
      </div>
      <div class="doc">
        <div class="tipo">${esc(doc.tipo)}</div>
        <div class="numero">Nº ${esc(String(doc.numero).padStart(4, "0"))}</div>
        ${doc.status ? `<span class="status ${esc(doc.status.classe ?? "")}">${esc(doc.status.label)}</span>` : ""}
        ${(doc.meta ?? []).map((m) => `<div class="meta">${esc(m)}</div>`).join("")}
      </div>
    </div>`;
}

export function blocoDados(titulo: string, principal: string, linhas: Array<string | null | undefined>) {
  return `
    <div class="bloco">
      <h3>${esc(titulo)}</h3>
      <p class="principal">${esc(principal || "—")}</p>
      ${linhas.filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join("")}
    </div>`;
}

export type ItemPdf = { tipo: "servico" | "peca"; nome: string; quantidade: number; unitario: Num; subtotal: Num };

export function tabelaItens(itens: ItemPdf[], total: Num, titulo = "Itens") {
  return `
    <div class="secao">
      <h3>${esc(titulo)}</h3>
      <table>
        <thead>
          <tr><th>Descrição</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Subtotal</th></tr>
        </thead>
        <tbody>
          ${
            itens.length
              ? itens
                  .map(
                    (i) => `
            <tr>
              <td><span class="tipo-item">${i.tipo === "peca" ? "Peça" : "Serviço"}</span>${esc(i.nome || "—")}</td>
              <td class="num">${esc(i.quantidade)}</td>
              <td class="num">${dinheiro(i.unitario)}</td>
              <td class="num">${dinheiro(i.subtotal)}</td>
            </tr>`
                  )
                  .join("")
              : `<tr><td colspan="4" class="vazio">Nenhum item adicionado</td></tr>`
          }
        </tbody>
      </table>
      <div class="totais">
        <div class="linha total"><span>Total</span><span>${dinheiro(total)}</span></div>
      </div>
    </div>`;
}

export type RecebimentoPdf = { data: Date | string; metodo: string; valor: Num };

/** Faixa de destaque do recibo: quem pagou e o valor, com o extenso (único lugar onde o total aparece). */
export function destaqueRecibo(cliente: string, valor: Num, extenso: string) {
  return `
    <div class="destaque">
      <div class="frase">Recebemos de <strong>${esc(cliente || "—")}</strong> a quantia de</div>
      <div class="valor">${dinheiro(valor)}</div>
      <div class="extenso">${esc(extenso)}</div>
    </div>`;
}

/** Forma de pagamento: uma linha quando há um só recebimento, tabela quando o pagamento foi dividido. */
export function formaPagamentoRecibo(linhas: RecebimentoPdf[]) {
  if (linhas.length === 1) {
    const [l] = linhas;
    return condicoes([
      { rotulo: "Forma de pagamento", valor: l.metodo },
      { rotulo: "Data do recebimento", valor: dataBr(l.data, true) },
    ], "Pagamento");
  }
  return `
    <div class="secao">
      <h3>Forma de pagamento</h3>
      <table>
        <thead>
          <tr><th>Data</th><th>Forma</th><th class="num">Valor</th></tr>
        </thead>
        <tbody>
          ${linhas
            .map((l) => `<tr><td>${esc(dataBr(l.data, true))}</td><td>${esc(l.metodo)}</td><td class="num">${dinheiro(l.valor)}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>`;
}

export function caixaTexto(titulo: string, texto: string) {
  return `<div class="secao"><h3>${esc(titulo)}</h3><div class="caixa">${esc(texto)}</div></div>`;
}

export function condicoes(itens: Array<{ rotulo: string; valor: string }>, titulo = "Condições") {
  return `
    <div class="secao">
      <h3>${esc(titulo)}</h3>
      <div class="condicoes">
        ${itens.map((i) => `<div class="item"><div class="rotulo">${esc(i.rotulo)}</div><div class="valor">${esc(i.valor)}</div></div>`).join("")}
      </div>
    </div>`;
}

/** Cada lado aceita mais de uma linha, separadas por "\n" (ex.: nome da pessoa e, embaixo, a empresa). */
export function assinaturas(esquerda: string, direita: string) {
  const linhas = (texto: string) => texto.split("\n").map(esc).join("<br>");
  return `
    <div class="assinaturas">
      <div class="linha-ass">${linhas(esquerda)}</div>
      <div class="linha-ass">${linhas(direita)}</div>
    </div>`;
}

export function documento(oficina: OficinaPdf, corpo: string, rodape: string, opts: { rodapeSimples?: boolean } = {}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head><meta charset="UTF-8" /><style>${css(oficina.cor_principal)}</style></head>
  <body>
    ${corpo}
    <footer>${
      opts.rodapeSimples
        ? "Emitido via Auttra. Este documento não tem validade fiscal."
        : `${esc(rodape)} · Emitido em ${esc(new Date().toLocaleDateString("pt-BR"))} por ${esc(oficina.nome)} via Auttra. Este documento não tem validade fiscal.`
    }</footer>
  </body>
</html>`;
}
