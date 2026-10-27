import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import puppeteer from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { escapeHtml } from "../src/utils/escapeHtml.js";
import { renderPdf } from "../src/services/pdfservice.service.js";

describe("escapeHtml", () => {
  it("escapa caracteres de marcacao", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'a'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;a&#39;"
    );
  });

  it("trata null, undefined e numeros", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(2024)).toBe("2024");
  });
});

const chromeDisponivel = (() => {
  try {
    return fs.existsSync(puppeteer.executablePath());
  } catch {
    return false;
  }
})();

describe.skipIf(!chromeDisponivel)("renderPdf (hardening do Chromium)", () => {
  let server: http.Server;
  let porta: number;
  const acessos: string[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      acessos.push(req.url ?? "");
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    porta = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("nao executa JS nem faz requisicoes externas ao renderizar HTML hostil", async () => {
    const alvo = `http://127.0.0.1:${porta}`;
    const html = `<html><body>
      <img src="${alvo}/img">
      <iframe src="${alvo}/iframe"></iframe>
      <link rel="stylesheet" href="${alvo}/css">
      <script>fetch("${alvo}/js")</script>
    </body></html>`;

    const pdf = await renderPdf(html);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(acessos).toEqual([]);
  }, 30_000);
});
