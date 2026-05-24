import puppeteer from "puppeteer";
import { Response } from "express";
import { prisma } from "../prisma/client.js";

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const buffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  });
  await browser.close();
  return Buffer.from(buffer);
}

export const PdfHtmlService = {
  async gerarOrcamentoPDF(id: number, res: Response, oficinaId: number) {
    const orc = await prisma.orcamento.findFirst({
      where: { id, deleted_at: null, cliente: { oficina_id: oficinaId } },
      include: { cliente: true, veiculo: true },
    });
    if (!orc) throw new Error("Orçamento não encontrado.");

    const money = (v: any) =>
      Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const STATUS_LABEL: Record<string, string> = {
      analise: "Em análise",
      aprovado: "Aprovado",
      recusado: "Recusado",
    };

    const html = `
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <style>
            * { box-sizing: border-box; }
            body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 40px; color: #333; background: #fff; }
            header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1976d2; padding-bottom: 12px; margin-bottom: 24px; }
            .logo { font-size: 26px; font-weight: 900; color: #1976d2; letter-spacing: -1px; }
            .doc-title { text-align: right; }
            .doc-title h1 { font-size: 20px; margin: 0 0 4px; color: #222; }
            .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #e3f2fd; color: #1565c0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
            .card { background: #f8f9fb; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; }
            .card h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
            .card p { margin: 3px 0; font-size: 14px; }
            .card .main { font-weight: 700; font-size: 15px; color: #111; }
            .desc-box { background: #f8f9fb; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; margin-bottom: 24px; }
            .desc-box h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
            .desc-box p { margin: 0; font-size: 14px; line-height: 1.6; }
            .valor-section { background: #1976d2; color: white; border-radius: 8px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
            .valor-section .label { font-size: 13px; opacity: 0.85; }
            .valor-section .amount { font-size: 28px; font-weight: 900; }
            footer { border-top: 1px solid #e0e0e0; padding-top: 12px; text-align: center; font-size: 11px; color: #aaa; }
          </style>
        </head>
        <body>
          <header>
            <div class="logo">DriveOn</div>
            <div class="doc-title">
              <h1>Orçamento #${orc.id}</h1>
              <span class="badge">${STATUS_LABEL[orc.status] ?? orc.status}</span>
              <p style="margin:4px 0 0;font-size:12px;color:#888;">
                Data: ${new Date(orc.data).toLocaleDateString("pt-BR")}
              </p>
              ${orc.validade ? `
                <p style="margin:2px 0 0;font-size:12px;color:#888;">
                  Válido até: ${new Date(orc.validade).toLocaleDateString("pt-BR")}
                </p>
              ` : ""}
            </div>
          </header>

          <div class="grid">
            <div class="card">
              <h3>Cliente</h3>
              <p class="main">${orc.cliente?.nome ?? "—"}</p>
              ${orc.cliente?.telefone ? `<p>${orc.cliente.telefone}</p>` : ""}
              ${orc.cliente?.email ? `<p>${orc.cliente.email}</p>` : ""}
              ${orc.cliente?.cpf ? `<p>CPF/CNPJ: ${orc.cliente.cpf}</p>` : ""}
            </div>
            <div class="card">
              <h3>Veículo</h3>
              <p class="main">${[orc.veiculo?.marca, orc.veiculo?.modelo].filter(Boolean).join(" ") || "—"}</p>
              ${orc.veiculo?.placa ? `<p>Placa: <strong>${orc.veiculo.placa}</strong></p>` : ""}
              ${orc.veiculo?.ano ? `<p>Ano: ${orc.veiculo.ano}</p>` : ""}
            </div>
          </div>

          <div class="desc-box">
            <h3>Descrição dos serviços</h3>
            <p>${orc.descricao || "Sem descrição informada."}</p>
          </div>

          <div class="valor-section">
            <div>
              <div class="label">Valor total do orçamento</div>
            </div>
            <div class="amount">${money(orc.valor)}</div>
          </div>

          <footer>
            Orçamento gerado automaticamente por DriveOn © ${new Date().getFullYear()}.
            Este documento não tem validade fiscal.
          </footer>
        </body>
      </html>
    `;

    const pdfBuffer = await renderPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=orcamento_${orc.id}.pdf`);
    res.end(pdfBuffer);
  },

  async gerarOrdemServicoPDF(id: number, res: Response, oficinaId: number) {
    const ordem = await prisma.ordem_servico.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: true,
        veiculo: true,
        funcionario: true,
        itens: { include: { servico: true, peca: true } },
      },
    });

    if (!ordem) throw new Error("Ordem de serviço não encontrada.");

    const money = (v: { toNumber?: () => number } | number | null | undefined) => {
      const value = typeof v === "number" ? v : v?.toNumber?.() ?? 0;
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const html = `
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              margin: 40px;
              color: #333;
            }
            header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #1976d2;
              padding-bottom: 8px;
              margin-bottom: 20px;
            }
            .logo {
              font-size: 22px;
              font-weight: 800;
              color: #1976d2;
            }
            h1 {
              font-size: 22px;
              margin: 0;
              color: #444;
            }
            .info {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              font-size: 14px;
              margin-bottom: 20px;
            }
            section {
              margin-top: 10px;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th {
              background-color: #1976d2;
              color: white;
              text-align: left;
              padding: 8px;
            }
            td {
              border-bottom: 1px solid #ccc;
              padding: 8px;
            }
            tfoot td {
              font-weight: bold;
              border-top: 2px solid #1976d2;
              text-align: right;
              font-size: 14px;
            }
            .obs {
              background: #f8f9fb;
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 12px;
              font-size: 13px;
            }
            footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #888;
            }
          </style>
        </head>
        <body>
          <header>
            <div class="logo">DriveOn</div>
            <div>
              <h1>Ordem de Serviço #${ordem.id}</h1>
              <p>Status: <strong>${ordem.status.toUpperCase()}</strong></p>
            </div>
          </header>

          <section class="info">
            <div>
              <h3>Cliente</h3>
              <p>${ordem.cliente?.nome ?? "-"}</p>
              <p>${ordem.cliente?.telefone ?? ""}</p>
            </div>
            <div>
              <h3>Veículo</h3>
              <p>${ordem.veiculo?.marca ?? ""} ${ordem.veiculo?.modelo ?? ""}</p>
              <p>Placa: ${ordem.veiculo?.placa ?? ""}</p>
              <p>Ano: ${ordem.veiculo?.ano ?? ""}</p>
            </div>
            <div>
              <h3>Funcionário</h3>
              <p>${ordem.funcionario?.nome ?? "-"}</p>
            </div>
          </section>

          <section>
            <h3>Itens</h3>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Qtd</th>
                  <th>Unitário</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${
                  ordem.itens.length
                    ? ordem.itens
                        .map(
                          (i) => `
                          <tr>
                            <td>${
                              i.tipo_item === "peca"
                                ? i.peca?.nome
                                : i.servico?.nome
                            }</td>
                            <td>${i.quantidade}</td>
                            <td>${money(i.preco_unitario)}</td>
                            <td>${money(i.subtotal)}</td>
                          </tr>`
                        )
                        .join("")
                    : `<tr><td colspan="4">Nenhum item adicionado</td></tr>`
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3">Total</td>
                  <td>${money(ordem.valor_total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section>
            <h3>Observações</h3>
            <div class="obs">
              ${
                ordem.observacoes?.trim()
                  ? ordem.observacoes
                  : "Nenhuma observação registrada."
              }
            </div>
          </section>

          <footer>
            Gerado automaticamente por DriveOn © ${new Date().getFullYear()}
          </footer>
        </body>
      </html>
    `;

    const pdfBuffer = await renderPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=ordem_${ordem.id}.pdf`);
    res.end(pdfBuffer);
  },
};
