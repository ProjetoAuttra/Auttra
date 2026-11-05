import puppeteer, { type Browser } from "puppeteer";
import { Semaforo } from "../utils/semaforo.js";
import { escapeHtml } from "../utils/escapeHtml.js";

const CONCORRENCIA = Number(process.env.PDF_CONCURRENCY) || 3;
const TIMEOUT_MS = Number(process.env.PDF_TIMEOUT_MS) || 30_000;

const semaforo = new Semaforo(CONCORRENCIA);
let navegador: Promise<Browser> | null = null;
let lancamentos = 0;

/** Um único Chromium para todos os PDFs; relança se ele cair. */
function obterNavegador(): Promise<Browser> {
  if (!navegador) {
    lancamentos++;
    const lancando = puppeteer
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      })
      .then((b) => {
        b.on("disconnected", () => {
          if (navegador === lancando) navegador = null;
        });
        return b;
      })
      .catch((err) => {
        if (navegador === lancando) navegador = null;
        throw err;
      });
    navegador = lancando;
  }
  return navegador;
}

/**
 * Renderiza o HTML em PDF. O navegador é compartilhado, cada renderização usa um contexto isolado
 * e no máximo PDF_CONCURRENCY rodam juntas; as demais esperam na fila.
 */
export type OpcoesPdf = {
  /** Texto do rodapé de cada página; ao lado vai "Página X de Y". Sem ele, o PDF sai sem rodapé. */
  rodape?: string;
};

/** O Chromium troca .pageNumber/.totalPages no rodapé sozinho (sem JS na página). */
function rodapeTemplate(texto: string) {
  return `<div style="width:100%;margin:0 12mm;font-family:Arial,sans-serif;font-size:7.5px;color:#6b7280;display:flex;justify-content:space-between;gap:12px;">
    <span>${escapeHtml(texto)}</span>
    <span style="white-space:nowrap">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;
}

export function renderizarPdf(html: string, opcoes: OpcoesPdf = {}): Promise<Buffer> {
  return semaforo.executar(async () => {
    const browser = await obterNavegador();
    const contexto = await browser.createBrowserContext();
    try {
      const page = await contexto.newPage();
      page.setDefaultTimeout(TIMEOUT_MS);
      // O HTML eh autocontido: sem JS e sem nenhuma requisicao de rede/arquivo (evita SSRF e leitura local).
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url();
        if (url.startsWith("data:") || url === "about:blank") return void request.continue();
        return void request.abort();
      });
      await page.setContent(html, { waitUntil: "load" });
      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: opcoes.rodape ? "16mm" : "12mm", left: "12mm", right: "12mm" },
        ...(opcoes.rodape
          ? { displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: rodapeTemplate(opcoes.rodape) }
          : {}),
      });
      return Buffer.from(buffer);
    } finally {
      await contexto.close().catch(() => {});
    }
  });
}

export async function fecharNavegadorPdf() {
  const atual = navegador;
  navegador = null;
  if (atual) await (await atual.catch(() => null))?.close().catch(() => {});
}

export const totalLancamentosNavegador = () => lancamentos;
