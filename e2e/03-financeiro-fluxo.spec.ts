import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Requires a running backend + seeded user (see .github/workflows/ci.yml, job "e2e-smoke",
// or run `npm run seed:admin` in Back/ locally with matching env vars).
const email = process.env.E2E_ADMIN_EMAIL ?? "";
const password = process.env.E2E_ADMIN_PASSWORD ?? "";

test.skip(!email || !password, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not configured");

const runTag = String(Date.now());

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function getToken(page: Page) {
  const token = await page.evaluate(
    () => localStorage.getItem("driveon:token") ?? sessionStorage.getItem("driveon:token")
  );
  if (!token) throw new Error("Token de autenticacao nao encontrado apos login.");
  return token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Cliente/veiculo/servico sao criados via API real (mesmos endpoints que a UI chama) para
// manter o teste focado no fluxo financeiro em si (OS -> cobranca automatica -> pagamento),
// que e o que esta spec existe para proteger.
async function criarFixtureBase(request: APIRequestContext, token: string, tag: string) {
  const headers = authHeaders(token);

  const clienteRes = await request.post("/api/clientes", {
    headers,
    data: { nome: `Cliente E2E Financeiro ${tag}` },
  });
  expect(clienteRes.ok(), await clienteRes.text()).toBeTruthy();
  const cliente = await clienteRes.json();

  const veiculoRes = await request.post("/api/veiculos", {
    headers,
    data: { cliente_id: cliente.id, placa: `E2E${tag.slice(-6)}`, marca: "Marca E2E", modelo: "Modelo E2E" },
  });
  expect(veiculoRes.ok(), await veiculoRes.text()).toBeTruthy();
  const veiculo = await veiculoRes.json();

  const servicoRes = await request.post("/api/servicos", {
    headers,
    data: { nome: `Servico E2E ${tag}`, preco: 300 },
  });
  expect(servicoRes.ok(), await servicoRes.text()).toBeTruthy();
  const servico = await servicoRes.json();

  return { cliente, veiculo, servico };
}

async function limparFixture(
  request: APIRequestContext,
  token: string,
  ids: { pagamentoIds?: number[]; ordemId?: number; veiculoId?: number; clienteId?: number; servicoId?: number }
) {
  const headers = authHeaders(token);
  for (const pagamentoId of ids.pagamentoIds ?? []) {
    await request.delete(`/api/pagamentos/${pagamentoId}`, { headers }).catch(() => {});
  }
  if (ids.ordemId) await request.delete(`/api/ordens/${ids.ordemId}`, { headers }).catch(() => {});
  if (ids.veiculoId) await request.delete(`/api/veiculos/${ids.veiculoId}`, { headers }).catch(() => {});
  if (ids.clienteId) await request.delete(`/api/clientes/${ids.clienteId}`, { headers }).catch(() => {});
  if (ids.servicoId) await request.delete(`/api/servicos/${ids.servicoId}`, { headers }).catch(() => {});
}

test.describe("Fluxo financeiro - OS concluida gera cobranca e recebe pagamento", () => {
  test("cria OS, conclui, gera cobranca automatica e registra pagamento parcial", async ({ page, request }) => {
    await login(page);
    const token = await getToken(page);
    const headers = authHeaders(token);
    const tag = `${runTag}a`;

    const { cliente, veiculo, servico } = await criarFixtureBase(request, token, tag);

    let ordemId: number | undefined;
    let pagamentoId: number | undefined;

    try {
      // Cria a OS pela interface, como o usuario faria.
      await page.goto("/tarefas");
      await page.getByRole("button", { name: "Nova Ordem" }).click();

      await page.getByLabel("Selecionar Cliente").click();
      await page.getByLabel("Selecionar Cliente").fill(cliente.nome);
      await page.getByRole("option", { name: cliente.nome }).click();

      await page.getByLabel("Selecionar Veículo").click();
      await page.getByRole("option", { name: new RegExp(veiculo.placa) }).click();

      await page.getByLabel("Selecionar Mecânico").click();
      await page.getByRole("option").first().click();

      await page.getByRole("button", { name: "Mão de Obra" }).click();
      await page.getByLabel("Pesquisar Serviço").click();
      await page.getByLabel("Pesquisar Serviço").fill(servico.nome);
      await page.getByRole("option", { name: new RegExp(servico.nome) }).click();
      await page.getByRole("button", { name: "Adicionar" }).click();

      const [createRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/ordens") && r.request().method() === "POST"),
        page.getByRole("button", { name: "Gerar Ordem de Serviço" }).click(),
      ]);
      expect(createRes.ok(), await createRes.text()).toBeTruthy();
      const ordem = await createRes.json();
      ordemId = ordem.id;
      const valorTotal = Number(ordem.valor_total);
      expect(valorTotal).toBeGreaterThan(0);
      await expect(page.getByText("Ordem de serviço criada!")).toBeVisible();

      // Não existe controle de UI para mudar o status da OS (nem "Iniciar", nem "Concluir OS") —
      // ver observação no relatório desta tarefa. A transição é feita via API, como o backend
      // realmente exige: aberta -> em_andamento -> concluida.
      const emAndamentoRes = await request.put(`/api/ordens/${ordemId}`, {
        headers,
        data: { status: "em_andamento" },
      });
      expect(emAndamentoRes.ok(), await emAndamentoRes.text()).toBeTruthy();

      const concluidaRes = await request.put(`/api/ordens/${ordemId}`, {
        headers,
        data: { status: "concluida" },
      });
      expect(concluidaRes.ok(), await concluidaRes.text()).toBeTruthy();

      // Confirma que o lançamento financeiro foi gerado automaticamente ao concluir a OS.
      const pagamentosRes = await request.get(`/api/pagamentos/cliente/${cliente.id}`, { headers });
      expect(pagamentosRes.ok()).toBeTruthy();
      const pagamentos = await pagamentosRes.json();
      const pagamentoGerado = pagamentos.find((p: any) => p.ordem_servico_id === ordemId);
      expect(pagamentoGerado, "Nenhum pagamento foi gerado automaticamente ao concluir a OS").toBeTruthy();
      pagamentoId = pagamentoGerado.id;
      expect(pagamentoGerado.status).toBe("pendente");
      expect(Number(pagamentoGerado.valor_original)).toBeCloseTo(valorTotal, 2);
      expect(Number(pagamentoGerado.valor_pago)).toBe(0);

      // Registra um pagamento parcial pela interface, em Contas a Receber.
      const valorEntrada = Math.round((valorTotal / 2) * 100) / 100;
      await page.goto("/contas-receber");
      const row = page.getByRole("row", { name: new RegExp(cliente.nome) });
      await expect(row).toBeVisible();
      await row.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Recebimento parcial" }).click();
      await page.getByLabel("Valor recebido agora *").fill(String(valorEntrada));
      await page.getByRole("button", { name: "Registrar entrada" }).click();
      await expect(page.getByText("Entrada registrada!")).toBeVisible();

      // Confirma saldo/status corretos no backend após o pagamento parcial.
      const pagamentoAtualizadoRes = await request.get(`/api/pagamentos/${pagamentoId}`, { headers });
      expect(pagamentoAtualizadoRes.ok()).toBeTruthy();
      const pagamentoAtualizado = await pagamentoAtualizadoRes.json();
      expect(pagamentoAtualizado.status).toBe("parcial");
      expect(Number(pagamentoAtualizado.valor_pago)).toBeCloseTo(valorEntrada, 2);
      const saldoRestante =
        Number(pagamentoAtualizado.valor_original) -
        Number(pagamentoAtualizado.desconto) -
        Number(pagamentoAtualizado.valor_pago);
      expect(saldoRestante).toBeCloseTo(valorTotal - valorEntrada, 2);

      // Confirma que a UI reflete o status parcial após recarregar a página.
      await page.reload();
      const reloadedRow = page.getByRole("row", { name: new RegExp(cliente.nome) });
      await expect(reloadedRow).toContainText("recebidos");
    } finally {
      await limparFixture(request, token, {
        pagamentoIds: pagamentoId ? [pagamentoId] : [],
        ordemId,
        veiculoId: veiculo.id,
        clienteId: cliente.id,
        servicoId: servico.id,
      });
    }
  });

  test("parcela uma cobrança pendente gerada pela conclusão da OS", async ({ page, request }) => {
    await login(page);
    const token = await getToken(page);
    const headers = authHeaders(token);
    const tag = `${runTag}b`;

    const { cliente, veiculo, servico } = await criarFixtureBase(request, token, tag);

    // Funcionário: a lista lazy-cria um funcionário para o gestor logado na primeira consulta
    // (Back/src/services/funcionarios.service.ts, ensureGestorComoFuncionario), então não é
    // preciso cadastrar um novo — só reaproveitar o primeiro da lista.
    const funcionariosRes = await request.get("/api/funcionarios", { headers });
    expect(funcionariosRes.ok()).toBeTruthy();
    const funcionarios = await funcionariosRes.json();
    expect(funcionarios.length, "Nenhum funcionário disponível para abrir a OS").toBeGreaterThan(0);
    const funcionarioId = funcionarios[0].id;

    const valorUnitario = 300;
    const ordemRes = await request.post("/api/ordens", {
      headers,
      data: {
        cliente_id: cliente.id,
        veiculo_id: veiculo.id,
        funcionario_id: funcionarioId,
        valor_total: valorUnitario,
        itens: [
          {
            tipo_item: "servico",
            servico_id: servico.id,
            quantidade: 1,
            preco_unitario: valorUnitario,
            subtotal: valorUnitario,
          },
        ],
      },
    });
    expect(ordemRes.ok(), await ordemRes.text()).toBeTruthy();
    const ordem = await ordemRes.json();
    const ordemId = ordem.id;
    let parcelaIds: number[] = [];

    try {
      await request.put(`/api/ordens/${ordemId}`, { headers, data: { status: "em_andamento" } });
      const concluidaRes = await request.put(`/api/ordens/${ordemId}`, { headers, data: { status: "concluida" } });
      expect(concluidaRes.ok(), await concluidaRes.text()).toBeTruthy();

      const pagamentosRes = await request.get(`/api/pagamentos/cliente/${cliente.id}`, { headers });
      const pagamentos = await pagamentosRes.json();
      const pagamentoGerado = pagamentos.find((p: any) => p.ordem_servico_id === ordemId);
      expect(pagamentoGerado, "Nenhum pagamento foi gerado automaticamente ao concluir a OS").toBeTruthy();
      const pagamentoId = pagamentoGerado.id;

      await page.goto("/contas-receber");
      const row = page.getByRole("row", { name: new RegExp(cliente.nome) });
      await expect(row).toBeVisible();
      await row.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Parcelar" }).click();

      // "Número de parcelas *" já vem com 2 por padrão no dialog; só falta a data da 1ª parcela.
      const hoje = new Date().toISOString().slice(0, 10);
      await page.getByLabel(/Data da 1ª parcela/).fill(hoje);
      await page.getByRole("button", { name: "Confirmar parcelamento" }).click();
      await expect(page.getByText("Título parcelado!")).toBeVisible();

      const parcelasRes = await request.get(`/api/pagamentos/cliente/${cliente.id}`, { headers });
      const parcelas = (await parcelasRes.json()).filter((p: any) => p.pagamento_pai_id === pagamentoId);
      expect(parcelas).toHaveLength(2);
      parcelaIds = parcelas.map((p: any) => p.id);
      for (const parcela of parcelas) {
        expect(parcela.status).toBe("pendente");
        expect(Number(parcela.valor_original)).toBeCloseTo(valorUnitario / 2, 2);
      }
    } finally {
      await limparFixture(request, token, {
        pagamentoIds: parcelaIds,
        ordemId,
        veiculoId: veiculo.id,
        clienteId: cliente.id,
        servicoId: servico.id,
      });
    }
  });
});
