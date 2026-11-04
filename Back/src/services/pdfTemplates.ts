import { escapeHtml as esc } from "../utils/escapeHtml.js";
import { formatarQuantidade } from "../utils/quantidade.js";

/**
 * Layout dos PDFs (orçamento, ordem de serviço e recibo) no formato que oficinas já usam:
 * cabeçalho em caixa com os dados da empresa e o número do documento, quadros com campos rotulados,
 * serviços e peças em tabelas separadas, quadro de totais, termos e assinaturas.
 * Todo texto vindo do banco passa por esc().
 */

type Num = { toNumber?: () => number } | number | string | null | undefined;

const numero = (v: Num) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : v?.toNumber?.() ?? 0;
  return Number.isFinite(n) ? n : 0;
};

export function dinheiro(v: Num) {
  return numero(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Datas só-dia (vencimento, validade) ficam em UTC; instantes (abertura, conclusão) usam o fuso de Brasília. */
export function dataBr(d: Date | string | null | undefined, instante = false) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: instante ? "America/Sao_Paulo" : "UTC" }) : "";
}

/** "04/11/2026 08:15", no fuso de Brasília. */
export function dataHoraBr(d: Date | string | null | undefined) {
  if (!d) return "";
  const hora = new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${dataBr(d, true)} ${hora}`;
}

/** "4 de novembro de 2026", no fuso de Brasília. */
export function dataExtenso(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });
}

export const numeroDoc = (n: number) => String(n).padStart(4, "0");

export type OficinaPdf = {
  nome: string;
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
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

/**
 * Termo de garantia com o prazo configurado pela oficina. Com 90 dias é a garantia legal e cita o CDC;
 * acima disso é garantia da própria oficina e não cita a lei.
 */
export function termoGarantia(dias: number) {
  const cobertura = "A garantia não cobre desgaste natural nem danos por mau uso, acidente ou serviço feito por terceiros.";
  return dias <= 90
    ? `Garantia legal de 90 dias para os serviços executados e as peças aplicadas, contada da entrega do veículo (art. 26, II, do Código de Defesa do Consumidor). ${cobertura}`
    : `Garantia de ${dias} dias para os serviços executados e as peças aplicadas, contada da entrega do veículo. ${cobertura}`;
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
  :root { --cor: ${p.principal}; --cor-escura: ${p.escura}; --sobre-cor: ${p.sobrePrincipal}; --cor-suave: ${p.suave}; --linha: #c7cbd1; --linha-fraca: #e5e7eb; }
  @page { size: A4; }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body { margin: 0; font-family: Arial, "Liberation Sans", Helvetica, sans-serif; font-size: 10.5px; line-height: 1.35; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  p { margin: 0; }

  .cab { display: flex; border: 1px solid var(--linha); border-radius: 4px; overflow: hidden; }
  .cab-logo { width: 96px; flex: none; display: flex; align-items: center; justify-content: center; padding: 8px; border-right: 1px solid var(--linha); }
  .cab-logo img { max-width: 78px; max-height: 78px; object-fit: contain; }
  .cab-empresa { flex: 1; padding: 8px 10px; font-size: 9.5px; color: #374151; }
  .cab-empresa .fantasia { font-size: 15px; font-weight: 700; color: var(--cor-escura); line-height: 1.2; margin-bottom: 2px; }
  .cab-doc { width: 200px; flex: none; border-left: 1px solid var(--linha); display: flex; flex-direction: column; }
  .doc-topo { background: var(--cor); color: var(--sobre-cor); text-align: center; padding: 6px 8px; }
  .doc-tipo { font-size: 9.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .doc-num { font-size: 19px; font-weight: 700; line-height: 1.15; }
  .doc-linhas { padding: 5px 9px; font-size: 9.5px; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 1px; }
  .doc-linha { display: flex; justify-content: space-between; gap: 8px; }
  .doc-linha span:first-child { color: #6b7280; }
  .doc-linha span:last-child { font-weight: 700; text-align: right; }

  .quadro { margin-top: 8px; border: 1px solid var(--linha); border-radius: 4px; overflow: hidden; break-inside: avoid; }
  .quadro-titulo { background: var(--cor-suave); color: var(--cor-escura); font-weight: 700; font-size: 9px; letter-spacing: .7px; text-transform: uppercase; padding: 4px 8px; border-bottom: 1px solid var(--linha); }
  .campos { display: grid; grid-template-columns: repeat(6, 1fr); margin: 0 -1px -1px 0; }
  .campo { border-right: 1px solid var(--linha-fraca); border-bottom: 1px solid var(--linha-fraca); padding: 3px 7px 4px; min-height: 29px; }
  .campo .r { font-size: 7.5px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .campo .v { font-size: 10.5px; font-weight: 600; word-break: break-word; }
  .s1 { grid-column: span 1; } .s2 { grid-column: span 2; } .s3 { grid-column: span 3; }
  .s4 { grid-column: span 4; } .s5 { grid-column: span 5; } .s6 { grid-column: span 6; }
  .texto { padding: 6px 8px; white-space: pre-wrap; }

  table.itens { width: 100%; border-collapse: collapse; }
  table.itens th { background: #f3f4f6; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #374151; padding: 4px 6px; border-bottom: 1px solid var(--linha); text-align: left; }
  table.itens td { padding: 4px 6px; border-bottom: 1px solid var(--linha-fraca); vertical-align: top; }
  table.itens tbody tr:nth-child(even) td { background: #fafafa; }
  table.itens tbody tr:last-child td { border-bottom: 0; }
  table.itens tfoot td { font-weight: 700; background: #f3f4f6; border-top: 1px solid var(--linha); }
  table.itens tr { break-inside: avoid; }
  .c-item { width: 30px; text-align: center !important; color: #6b7280; }
  .c-qtd { width: 48px; } .c-un { width: 34px; text-align: center !important; } .c-valor { width: 86px; }
  .num { text-align: right !important; white-space: nowrap; }
  .vazio { text-align: center; color: #9ca3af; padding: 12px 8px; }

  .fechamento { display: grid; grid-template-columns: 1fr 230px; gap: 8px; margin-top: 8px; align-items: start; break-inside: avoid; }
  .fechamento > .quadro { margin-top: 0; }
  .fechamento .campos { grid-template-columns: 1fr; }
  .totais { border: 1px solid var(--linha); border-radius: 4px; overflow: hidden; }
  .totais .l { display: flex; justify-content: space-between; padding: 4px 9px; border-bottom: 1px solid var(--linha-fraca); }
  .totais .l span:first-child { color: #4b5563; }
  .totais .geral { background: var(--cor); color: var(--sobre-cor); font-size: 13px; font-weight: 700; padding: 7px 9px; border: 0; }
  .totais .geral span:first-child { color: inherit; }

  .fecho { break-inside: avoid; }
  .termo { margin-top: 8px; padding: 6px 8px; border: 1px solid var(--linha-fraca); border-radius: 4px; font-size: 8.5px; color: #374151; text-align: justify; }
  .termo p + p { margin-top: 3px; }
  .local-data { margin-top: 20px; text-align: center; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; margin-top: 38px; }
  .linha-ass { border-top: 1px solid #111827; padding-top: 3px; text-align: center; font-size: 9px; color: #374151; }
  .linha-ass strong { color: #111827; }

  .via { position: relative; height: 116mm; border: 1px solid var(--linha); border-radius: 4px; padding: 12px 14px 10px; display: flex; flex-direction: column; }
  .via-rotulo { position: absolute; top: -6px; right: 14px; background: #fff; padding: 0 6px; font-size: 7.5px; letter-spacing: .7px; text-transform: uppercase; color: #6b7280; }
  .rec-topo { display: flex; gap: 12px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--linha); }
  .rec-topo img { width: 58px; height: 58px; object-fit: contain; flex: none; }
  .rec-empresa { flex: 1; font-size: 9px; color: #374151; }
  .rec-empresa .fantasia { font-size: 14px; font-weight: 700; color: var(--cor-escura); }
  .rec-caixas { display: flex; gap: 6px; flex: none; }
  .rec-caixa { border: 1px solid var(--linha); border-radius: 4px; overflow: hidden; text-align: center; min-width: 96px; }
  .rec-caixa .r { background: var(--cor); color: var(--sobre-cor); font-size: 8px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; padding: 3px 8px; }
  .rec-caixa .v { font-size: 15px; font-weight: 700; padding: 5px 10px; white-space: nowrap; }
  .rec-titulo { text-align: center; font-size: 16px; font-weight: 700; letter-spacing: 4px; margin: 12px 0 2px; }
  .rec-corpo { font-size: 11.5px; line-height: 1.75; text-align: justify; margin-top: 8px; }
  .rec-corpo p + p { margin-top: 6px; }
  .rec-data { text-align: right; margin-top: 12px; font-size: 11px; }
  .rec-ass { margin: auto auto 0; width: 62%; text-align: center; border-top: 1px solid #111827; padding-top: 3px; font-size: 9.5px; color: #374151; }
  .rec-ass strong { color: #111827; }
  .corte { height: 10mm; display: flex; align-items: center; gap: 8px; color: #9ca3af; font-size: 7.5px; text-transform: uppercase; letter-spacing: .7px; }
  .corte::before, .corte::after { content: ""; flex: 1; border-top: 1px dashed #9ca3af; }
`;
};

const juntar = (partes: Array<string | null | undefined | false>, sep: string) => partes.filter((p): p is string => !!p && !!p.trim()).join(sep);

function enderecoOficina(o: OficinaPdf) {
  const rua = juntar([juntar([o.logradouro, o.numero], ", "), o.complemento], " - ");
  return juntar([rua, o.bairro, o.cidade ? `${o.cidade.nome}/${o.cidade.uf}` : null, o.cep ? `CEP ${o.cep}` : null], " - ");
}

function linhasEmpresa(o: OficinaPdf) {
  return [
    o.razao_social && o.razao_social.trim() !== o.nome.trim() ? o.razao_social : null,
    juntar([o.cnpj ? `CNPJ: ${o.cnpj}` : null, o.inscricao_estadual ? `IE: ${o.inscricao_estadual}` : null], " · "),
    enderecoOficina(o),
    juntar([o.telefone ? `Tel.: ${o.telefone}` : null, o.whatsapp ? `WhatsApp: ${o.whatsapp}` : null, o.email], " · "),
  ].filter((l): l is string => !!l && !!l.trim());
}

export type LinhaDoc = { rotulo: string; valor: string };

/** Cabeçalho em caixa: logo, dados da empresa e, à direita, o tipo e o número do documento com datas. */
export function cabecalho(oficina: OficinaPdf, doc: { tipo: string; numero: number; linhas?: LinhaDoc[] }) {
  const logo = logoSegura(oficina.logo_url);
  return `
    <div class="cab">
      ${logo ? `<div class="cab-logo"><img src="${esc(logo)}" alt="" /></div>` : ""}
      <div class="cab-empresa">
        <div class="fantasia">${esc(oficina.nome)}</div>
        ${linhasEmpresa(oficina).map((l) => `<p>${esc(l)}</p>`).join("")}
      </div>
      <div class="cab-doc">
        <div class="doc-topo">
          <div class="doc-tipo">${esc(doc.tipo)}</div>
          <div class="doc-num">Nº ${esc(numeroDoc(doc.numero))}</div>
        </div>
        <div class="doc-linhas">
          ${(doc.linhas ?? []).map((l) => `<div class="doc-linha"><span>${esc(l.rotulo)}</span><span>${esc(l.valor)}</span></div>`).join("")}
        </div>
      </div>
    </div>`;
}

/** Campo de um quadro; `largura` é quantas das 6 colunas ele ocupa. */
export type CampoPdf = { rotulo: string; valor?: string | null; largura?: 1 | 2 | 3 | 4 | 5 | 6 };

/** Quadro com título e campos rotulados em grade (como um formulário preenchido). */
export function quadro(titulo: string, campos: CampoPdf[]) {
  return `
    <div class="quadro">
      <div class="quadro-titulo">${esc(titulo)}</div>
      <div class="campos">
        ${campos
          .map((c) => `<div class="campo s${c.largura ?? 2}"><div class="r">${esc(c.rotulo)}</div><div class="v">${c.valor?.trim() ? esc(c.valor) : "&nbsp;"}</div></div>`)
          .join("")}
      </div>
    </div>`;
}

export function caixaTexto(titulo: string, texto: string) {
  return `<div class="quadro"><div class="quadro-titulo">${esc(titulo)}</div><div class="texto">${esc(texto)}</div></div>`;
}

export type ClientePdf = {
  nome?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cep?: string | null;
  cidade?: { nome: string; uf: string } | null;
};

export function quadroCliente(c?: ClientePdf | null) {
  const endereco = juntar([juntar([c?.logradouro, c?.numero], ", "), c?.complemento], " - ");
  return quadro("Dados do cliente", [
    { rotulo: "Nome / Razão social", valor: c?.nome, largura: 4 },
    { rotulo: "CPF / CNPJ", valor: c?.cpf, largura: 2 },
    { rotulo: "Endereço", valor: endereco, largura: 4 },
    { rotulo: "Cidade / UF", valor: c?.cidade ? `${c.cidade.nome}/${c.cidade.uf}` : null, largura: 2 },
    { rotulo: "Telefone", valor: c?.telefone, largura: 2 },
    { rotulo: "E-mail", valor: c?.email, largura: 3 },
    { rotulo: "CEP", valor: c?.cep, largura: 1 },
  ]);
}

export type VeiculoPdf = {
  marca?: string | null;
  modelo?: string | null;
  placa?: string | null;
  ano?: number | string | null;
  cor?: string | null;
  combustivel?: string | null;
  quilometragem?: number | null;
};

/** `extra` ocupa 2 colunas no fim da segunda linha (ex.: responsável técnico na OS). */
export function quadroVeiculo(v?: VeiculoPdf | null, extra?: CampoPdf) {
  return quadro("Dados do veículo", [
    { rotulo: "Marca / Modelo", valor: juntar([v?.marca, v?.modelo], " "), largura: 3 },
    { rotulo: "Placa", valor: v?.placa?.toUpperCase(), largura: 1 },
    { rotulo: "Ano", valor: v?.ano ? String(v.ano) : null, largura: 1 },
    { rotulo: "KM", valor: v?.quilometragem != null ? v.quilometragem.toLocaleString("pt-BR") : null, largura: 1 },
    { rotulo: "Cor", valor: v?.cor, largura: 2 },
    { rotulo: "Combustível", valor: v?.combustivel, largura: extra ? 2 : 4 },
    ...(extra ? [{ ...extra, largura: 2 as const }] : []),
  ]);
}

export type ItemPdf = { tipo: "servico" | "peca"; nome: string; quantidade: Num; unidade?: string | null; unitario: Num; subtotal: Num };

const somar = (itens: ItemPdf[]) => Math.round(itens.reduce((acc, i) => acc + numero(i.subtotal), 0) * 100) / 100;

function tabela(titulo: string, itens: ItemPdf[], comUnidade: boolean, rotuloTotal: string) {
  const colunas = comUnidade ? 6 : 5;
  return `
    <div class="quadro">
      <div class="quadro-titulo">${esc(titulo)}</div>
      <table class="itens">
        <thead>
          <tr>
            <th class="c-item">Item</th><th>Descrição</th><th class="c-qtd num">Qtd</th>
            ${comUnidade ? `<th class="c-un">Un</th>` : ""}
            <th class="c-valor num">Vl. unit.</th><th class="c-valor num">Vl. total</th>
          </tr>
        </thead>
        <tbody>
          ${itens
            .map(
              (i, idx) => `
          <tr>
            <td class="c-item">${String(idx + 1).padStart(2, "0")}</td>
            <td>${esc(i.nome || "—")}</td>
            <td class="num">${esc(formatarQuantidade(i.quantidade))}</td>
            ${comUnidade ? `<td class="c-un">${esc(i.unidade || "UN")}</td>` : ""}
            <td class="num">${dinheiro(i.unitario)}</td>
            <td class="num">${dinheiro(i.subtotal)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
        <tfoot><tr><td colspan="${colunas - 1}" class="num">${esc(rotuloTotal)}</td><td class="num">${dinheiro(somar(itens))}</td></tr></tfoot>
      </table>
    </div>`;
}

/** Serviços e peças em tabelas separadas (só aparece a que tiver itens). */
export function tabelasItens(itens: ItemPdf[]) {
  const servicos = itens.filter((i) => i.tipo === "servico");
  const pecas = itens.filter((i) => i.tipo === "peca");
  if (!servicos.length && !pecas.length) {
    return `<div class="quadro"><div class="quadro-titulo">Serviços e peças</div><div class="vazio">Nenhum item adicionado</div></div>`;
  }
  return [
    servicos.length ? tabela("Serviços", servicos, false, "Total de serviços") : "",
    pecas.length ? tabela("Peças", pecas, true, "Total de peças") : "",
  ].join("");
}

/** Condições à esquerda e quadro de totais (serviços, peças e total geral) à direita. */
export function fechamento(itens: ItemPdf[], total: Num, condicoesCampos: CampoPdf[]) {
  const servicos = itens.filter((i) => i.tipo === "servico");
  const pecas = itens.filter((i) => i.tipo === "peca");
  return `
    <div class="fechamento">
      ${condicoesCampos.length ? quadro("Condições", condicoesCampos.map((c) => ({ ...c, largura: 6 }))) : "<div></div>"}
      <div class="totais">
        <div class="l"><span>Total de serviços</span><span>${dinheiro(somar(servicos))}</span></div>
        <div class="l"><span>Total de peças</span><span>${dinheiro(somar(pecas))}</span></div>
        <div class="l geral"><span>TOTAL GERAL</span><span>${dinheiro(total)}</span></div>
      </div>
    </div>`;
}

/**
 * Termos, local/data e assinaturas, sempre juntos na mesma página.
 * Cada lado da assinatura aceita mais de uma linha, separadas por "\n" (a primeira sai em negrito).
 */
export function assinaturas(esquerda: string, direita: string, opts: { termos?: string[]; cidade?: string | null } = {}) {
  const linhas = (texto: string) =>
    texto
      .split("\n")
      .map((l, i) => (i === 0 ? `<strong>${esc(l)}</strong>` : esc(l)))
      .join("<br>");
  const termos = opts.termos?.filter((t) => t.trim()) ?? [];
  return `
    <div class="fecho">
      ${termos.length ? `<div class="termo">${termos.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
      <div class="local-data">${opts.cidade ? `${esc(opts.cidade)}, ` : "Local: ______________________, "}_____ de ____________________ de ________</div>
      <div class="assinaturas">
        <div class="linha-ass">${linhas(esquerda)}</div>
        <div class="linha-ass">${linhas(direita)}</div>
      </div>
    </div>`;
}

export type RecebimentoPdf = { data: Date | string; metodo: string; valor: Num };

export type ReciboPdf = {
  numero: number;
  valor: Num;
  extenso: string;
  pagador: string;
  documentoPagador?: string | null;
  referente: string;
  recebimentos: RecebimentoPdf[];
  data: Date | string;
  emissor?: string | null;
};

function formaRecebimento(linhas: RecebimentoPdf[]) {
  if (linhas.length === 1) return `${linhas[0].metodo}, em ${dataBr(linhas[0].data, true)}`;
  return linhas.map((l) => `${l.metodo} ${dinheiro(l.valor)} em ${dataBr(l.data, true)}`).join("; ");
}

function viaRecibo(oficina: OficinaPdf, r: ReciboPdf, rotulo: string) {
  const logo = logoSegura(oficina.logo_url);
  const pagador = r.documentoPagador ? `${r.pagador}, CPF/CNPJ ${r.documentoPagador}` : r.pagador;
  return `
    <div class="via">
      <div class="via-rotulo">${esc(rotulo)}</div>
      <div class="rec-topo">
        ${logo ? `<img src="${esc(logo)}" alt="" />` : ""}
        <div class="rec-empresa">
          <div class="fantasia">${esc(oficina.nome)}</div>
          ${linhasEmpresa(oficina).map((l) => `<p>${esc(l)}</p>`).join("")}
        </div>
        <div class="rec-caixas">
          <div class="rec-caixa"><div class="r">Recibo Nº</div><div class="v">${esc(numeroDoc(r.numero))}</div></div>
          <div class="rec-caixa"><div class="r">Valor</div><div class="v">${dinheiro(r.valor)}</div></div>
        </div>
      </div>
      <div class="rec-titulo">RECIBO</div>
      <div class="rec-corpo">
        <p>Recebemos de <strong>${esc(pagador || "—")}</strong> a importância de <strong>${dinheiro(r.valor)}</strong> (${esc(r.extenso)}), referente a <strong>${esc(r.referente)}</strong>.</p>
        <p>Forma de pagamento: ${esc(formaRecebimento(r.recebimentos))}.</p>
        <p>Para clareza, firmamos o presente recibo, dando quitação do valor acima.</p>
      </div>
      <div class="rec-data">${oficina.cidade ? `${esc(oficina.cidade.nome)}, ` : ""}${esc(dataExtenso(r.data))}.</div>
      <div class="rec-ass">
        ${r.emissor ? `<strong>${esc(r.emissor)}</strong><br>${esc(oficina.nome)}` : `<strong>${esc(oficina.nome)}</strong>`}
        ${oficina.cnpj ? `<br>CNPJ ${esc(oficina.cnpj)}` : ""}
      </div>
    </div>`;
}

/** Recibo em duas vias na mesma folha (cliente e oficina), com linha de corte. */
export function recibo(oficina: OficinaPdf, r: ReciboPdf) {
  return `${viaRecibo(oficina, r, "Via do cliente")}<div class="corte">corte aqui</div>${viaRecibo(oficina, r, "Via da oficina")}`;
}

export function documento(oficina: OficinaPdf, corpo: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head><meta charset="UTF-8" /><style>${css(oficina.cor_principal)}</style></head>
  <body>
    ${corpo}
  </body>
</html>`;
}

/** Texto do rodapé de cada página (o número da página é colocado pelo gerador de PDF). */
export function rodape(oficina: OficinaPdf, doc: string) {
  return `${doc} · Emitido em ${dataHoraBr(new Date())} por ${oficina.nome} via Auttra · Documento sem valor fiscal`;
}
