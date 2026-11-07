import { Router } from "express";
import { PagamentosService } from "../services/pagamentos.service.js";
import { getRequiredOfficeId, requirePermission } from "../middlewares/ensureAuth.js";
import { FinanceiroConfigService } from "../services/configuracoesOperacionais.service.js";
import { PdfHtmlService } from "../services/pdfservice.service.js";
import { parsePaginacao, responderLista, textoQuery } from "../utils/paginacao.js";

const router = Router();

/** Indica ao front se deve abrir o recibo logo após a baixa: recebimento já quitado e opção "emitir recibos" ligada. */
async function comFlagRecibo<T extends { tipo?: string | null; status?: string | null }>(result: T, oficinaId: number) {
  const emitir = result.tipo === "receber" && result.status === "pago" && (await FinanceiroConfigService.get(oficinaId)).emitirRecibos;
  return { ...result, emitir_recibo: emitir };
}

router.get("/", async (req, res) => {
  const oficina_id = getRequiredOfficeId(req);
  const cliente_id = req.query.clienteId ?? req.query.cliente_id;
  const data = await PagamentosService.list(
    oficina_id,
    {
      cliente_id: cliente_id ? Number(cliente_id) : undefined,
      tipo: textoQuery(req.query.tipo) || undefined,
      status: textoQuery(req.query.status) || undefined,
      metodo: textoQuery(req.query.metodo) || undefined,
      maquininha: textoQuery(req.query.maquininha) || undefined,
      fornecedor_id: req.query.fornecedor_id ? Number(req.query.fornecedor_id) : undefined,
      vencimento_de: textoQuery(req.query.vencimento_de) || undefined,
      vencimento_ate: textoQuery(req.query.vencimento_ate) || undefined,
      pagamento_de: textoQuery(req.query.pagamento_de) || undefined,
      pagamento_ate: textoQuery(req.query.pagamento_ate) || undefined,
      tz_offset: textoQuery(req.query.tz_offset) || undefined,
      hoje: textoQuery(req.query.hoje) || undefined,
      search: textoQuery(req.query.search) || undefined,
      ordem: textoQuery(req.query.ordem) || undefined,
    },
    parsePaginacao(req.query)
  );
  responderLista(res, data);
});

router.get("/resumo", async (req, res) => {
  const tipo = req.query.tipo === "pagar" ? "pagar" : "receber";
  res.json(await PagamentosService.resumo(getRequiredOfficeId(req), tipo, textoQuery(req.query.hoje) || undefined));
});

router.get("/cliente/:cliente_id", async (req, res) => {
  const cliente_id = Number(req.params.cliente_id);
  const data = await PagamentosService.listByCliente(cliente_id, getRequiredOfficeId(req));
  res.json(data);
});

router.get("/extrato/resumo", async (req, res) => {
  res.json(
    await PagamentosService.extratoResumo(getRequiredOfficeId(req), {
      pagamento_de: textoQuery(req.query.pagamento_de) || undefined,
      pagamento_ate: textoQuery(req.query.pagamento_ate) || undefined,
      tz_offset: textoQuery(req.query.tz_offset) || undefined,
    })
  );
});

// Extrato por efetivação: quando e quanto cai na conta (cartão líquido, por parcela).
router.get("/extrato/efetivacao", async (req, res) => {
  const data = await PagamentosService.extratoEfetivacao(
    getRequiredOfficeId(req),
    {
      de: textoQuery(req.query.de) || undefined,
      ate: textoQuery(req.query.ate) || undefined,
      tipo: textoQuery(req.query.tipo) || undefined,
      metodo: textoQuery(req.query.metodo) || undefined,
      maquininha: textoQuery(req.query.maquininha) || undefined,
    },
    parsePaginacao(req.query)
  );
  responderLista(res, data);
});

router.get("/extrato/efetivacao/resumo", async (req, res) => {
  res.json(
    await PagamentosService.extratoEfetivacaoResumo(getRequiredOfficeId(req), {
      de: textoQuery(req.query.de) || undefined,
      ate: textoQuery(req.query.ate) || undefined,
    })
  );
});

router.get("/extrato/a-cair", async (req, res) => {
  res.json(await PagamentosService.aCair(getRequiredOfficeId(req)));
});

router.get("/:id/recibo", async (req, res) => {
  await PdfHtmlService.gerarReciboPDF(Number(req.params.id), res, getRequiredOfficeId(req), req.user?.id);
});

router.get("/:id", async (req, res) => {
  const p = await PagamentosService.getById(Number(req.params.id), getRequiredOfficeId(req));
  res.json(p);
});

router.post("/", async (req, res) => {
  const novo = await PagamentosService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
  res.status(201).json(novo);
});

// ── Ações financeiras ────────────────────────────────────────────────────────

router.post("/:id/pagar", async (req, res) => {
  const oficinaId = getRequiredOfficeId(req);
  const result = await PagamentosService.pagar(Number(req.params.id), req.body, oficinaId, req.user?.id);
  res.json(await comFlagRecibo(result, oficinaId));
});

router.post("/:id/desconto", async (req, res) => {
  const result = await PagamentosService.aplicarDesconto(
    Number(req.params.id), req.body, getRequiredOfficeId(req)
  );
  res.json(result);
});

router.post("/:id/multa", async (req, res) => {
  const result = await PagamentosService.aplicarMulta(
    Number(req.params.id), req.body, getRequiredOfficeId(req)
  );
  res.json(result);
});

router.post("/:id/renegociar", async (req, res) => {
  const result = await PagamentosService.renegociar(
    Number(req.params.id), req.body, getRequiredOfficeId(req)
  );
  res.json(result);
});

router.post("/:id/pagamento-parcial", async (req, res) => {
  const oficinaId = getRequiredOfficeId(req);
  const result = await PagamentosService.pagamentoParcial(Number(req.params.id), req.body, oficinaId, req.user?.id);
  res.json(await comFlagRecibo(result, oficinaId));
});

// Estorno eh mais sensivel que uma baixa: exige permissao de exclusao no financeiro (e nao so "create" do POST)
router.post("/:id/estornar", requirePermission("financeiro", "delete"), async (req, res) => {
  const result = await PagamentosService.estornar(
    Number(req.params.id), req.body, getRequiredOfficeId(req), req.user?.id
  );
  res.json(result);
});

router.get("/:id/movimentos", async (req, res) => {
  res.json(await PagamentosService.listarMovimentos(Number(req.params.id), getRequiredOfficeId(req)));
});

router.post("/:id/parcelar", async (req, res) => {
  const result = await PagamentosService.parcelar(
    Number(req.params.id), req.body, getRequiredOfficeId(req)
  );
  res.status(201).json(result);
});

// ── CRUD genérico ────────────────────────────────────────────────────────────

router.put("/:id", async (req, res) => {
  const upd = await PagamentosService.update(Number(req.params.id), req.body, getRequiredOfficeId(req));
  res.json(upd);
});

router.delete("/:id", async (req, res) => {
  await PagamentosService.delete(Number(req.params.id), getRequiredOfficeId(req));
  res.status(204).send();
});

export default router;
