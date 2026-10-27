import { Router } from "express";
import { PagamentosService } from "../services/pagamentos.service.js";
import { getRequiredOfficeId, requirePermission } from "../middlewares/ensureAuth.js";
import { sendServiceError } from "../utils/httpError.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const oficina_id = getRequiredOfficeId(req);
    const cliente_id = req.query.clienteId ?? req.query.cliente_id;
    const data = await PagamentosService.list(oficina_id, cliente_id ? Number(cliente_id) : undefined);
    res.json(data);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.get("/cliente/:cliente_id", async (req, res) => {
  try {
    const cliente_id = Number(req.params.cliente_id);
    const data = await PagamentosService.listByCliente(cliente_id, getRequiredOfficeId(req));
    res.json(data);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.get("/extrato/oficina/:oficina_id", async (req, res) => {
  try {
    const oficina_id = getRequiredOfficeId(req);
    const { from, to } = req.query as any;
    const data = await PagamentosService.extrato(oficina_id, from, to);
    res.json(data);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const p = await PagamentosService.getById(Number(req.params.id), getRequiredOfficeId(req));
    res.json(p);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.post("/", async (req, res) => {
  try {
    const novo = await PagamentosService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
    res.status(201).json(novo);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

// ── Ações financeiras ────────────────────────────────────────────────────────

router.post("/:id/pagar", async (req, res) => {
  try {
    const result = await PagamentosService.pagar(
      Number(req.params.id), req.body, getRequiredOfficeId(req), req.user?.id
    );
    res.json(result);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.post("/:id/desconto", async (req, res) => {
  try {
    const result = await PagamentosService.aplicarDesconto(
      Number(req.params.id), req.body, getRequiredOfficeId(req)
    );
    res.json(result);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.post("/:id/renegociar", async (req, res) => {
  try {
    const result = await PagamentosService.renegociar(
      Number(req.params.id), req.body, getRequiredOfficeId(req)
    );
    res.json(result);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.post("/:id/pagamento-parcial", async (req, res) => {
  try {
    const result = await PagamentosService.pagamentoParcial(
      Number(req.params.id), req.body, getRequiredOfficeId(req), req.user?.id
    );
    res.json(result);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

// Estorno eh mais sensivel que uma baixa: exige permissao de exclusao no financeiro (e nao so "create" do POST)
router.post("/:id/estornar", requirePermission("financeiro", "delete"), async (req, res) => {
  try {
    const result = await PagamentosService.estornar(
      Number(req.params.id), req.body, getRequiredOfficeId(req), req.user?.id
    );
    res.json(result);
  } catch (err) {
    sendServiceError(res, err, "pagamentos/estornar");
  }
});

router.get("/:id/movimentos", async (req, res) => {
  try {
    res.json(await PagamentosService.listarMovimentos(Number(req.params.id), getRequiredOfficeId(req)));
  } catch (err) {
    sendServiceError(res, err, "pagamentos/movimentos");
  }
});

router.post("/:id/parcelar", async (req, res) => {
  try {
    const result = await PagamentosService.parcelar(
      Number(req.params.id), req.body, getRequiredOfficeId(req)
    );
    res.status(201).json(result);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

// ── CRUD genérico ────────────────────────────────────────────────────────────

router.put("/:id", async (req, res) => {
  try {
    const upd = await PagamentosService.update(Number(req.params.id), req.body, getRequiredOfficeId(req));
    res.json(upd);
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await PagamentosService.delete(Number(req.params.id), getRequiredOfficeId(req));
    res.status(204).send();
  } catch (err) {
    sendServiceError(res, err, "pagamentos");
  }
});

export default router;
