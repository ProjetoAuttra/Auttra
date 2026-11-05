import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import PublicTrackingPage from "../modules/acompanhamento/PublicTrackingPage";
import OrcamentoDetalhes from "../modules/orcamentos/pages/detalhesorcamento/detalhesorcamento";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => toast }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("../modules/orcamentos/useAcoesOrcamento", () => ({
  useAcoesOrcamento: () => ({ acaoPrincipal: () => null, podeRecusar: () => false, recusar: vi.fn() }),
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const CODE = "6f1c2b9e-1111-4222-8333-944455556666";

const orcamentoPublico = (extra: object = {}) => ({
  type: "orcamento",
  id: 12,
  code: CODE,
  title: "ORC #012",
  status: "analise",
  statusLabel: "Em análise",
  statusTone: "warning",
  progress: 40,
  documentUrl: `/api/s/${CODE}/pdf`,
  oficina: { nome: "Oficina Boa", telefone: null },
  cliente: { nome: "Ana" },
  veiculo: { marca: "Fiat", modelo: "Uno", placa: "ABC1D23" },
  descricao: "",
  total: 350,
  datas: { abertura: "2026-11-04T12:00:00.000Z", fechamento: null, validade: "2026-11-11T00:00:00.000Z" },
  itens: [],
  timeline: [],
  vencido: false,
  podeResponder: true,
  resposta: null,
  ...extra,
});

function erro409(message: string, code: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("409", "ERR_BAD_REQUEST", config, null, {
    status: 409,
    statusText: "Conflict",
    data: { message, code },
    headers: {},
    config,
  });
}

describe("link público: cliente responde o orçamento", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  const setup = () => {
    renderWithProviders(
      <MemoryRouter initialEntries={[`/acompanhamento/${CODE}`]}>
        <Routes>
          <Route path="/acompanhamento/:code" element={<PublicTrackingPage />} />
        </Routes>
      </MemoryRouter>
    );
    return userEvent.setup();
  };

  it("mostra a validade no dia certo (só-dia em UTC)", async () => {
    get.mockResolvedValue({ data: orcamentoPublico() });
    setup();
    expect(await screen.findByText("11/11/2026")).toBeInTheDocument();
  });

  it("aprovar: confirma no diálogo, envia o nome e troca os botões pela resposta", async () => {
    get.mockResolvedValue({ data: orcamentoPublico() });
    post.mockResolvedValue({
      data: orcamentoPublico({
        status: "aprovado",
        statusLabel: "Aprovado",
        podeResponder: false,
        resposta: { decisao: "aprovado", em: "2026-11-04T17:32:00.000Z", nome: "Ana", motivo: null },
      }),
    });
    const user = setup();

    await user.click(await screen.findByRole("button", { name: "Aprovar orçamento" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/R\$\s350,00/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Seu nome (opcional)"), "Ana");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar aprovação" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(`/public/acompanhamento/${CODE}/aprovar`, { nome: "Ana" }));
    expect(await screen.findByTestId("resposta-cliente")).toHaveTextContent("Orçamento aprovado em 04/11/2026, 14:32 por Ana.");
    expect(screen.queryByRole("button", { name: "Aprovar orçamento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();
  });

  it("recusar envia nome e motivo", async () => {
    get.mockResolvedValue({ data: orcamentoPublico() });
    post.mockResolvedValue({
      data: orcamentoPublico({ status: "recusado", podeResponder: false, resposta: { decisao: "recusado", em: "2026-11-04T17:32:00.000Z", nome: null, motivo: "Caro" } }),
    });
    const user = setup();

    await user.click(await screen.findByRole("button", { name: "Recusar" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Motivo (opcional)"), "Caro");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar recusa" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(`/public/acompanhamento/${CODE}/recusar`, { nome: "", motivo: "Caro" }));
    expect(await screen.findByTestId("resposta-cliente")).toHaveTextContent("Motivo: Caro");
  });

  it("409 (já respondido): mostra a mensagem do servidor e recarrega a situação", async () => {
    get
      .mockResolvedValueOnce({ data: orcamentoPublico() })
      .mockResolvedValueOnce({
        data: orcamentoPublico({ status: "aprovado", podeResponder: false, resposta: { decisao: "aprovado", em: "2026-11-04T17:00:00.000Z", nome: null, motivo: null } }),
      });
    post.mockRejectedValue(erro409("Este orçamento já foi respondido.", "ORCAMENTO_JA_RESPONDIDO"));
    const user = setup();

    await user.click(await screen.findByRole("button", { name: "Recusar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar recusa" }));

    expect(await screen.findByTestId("resposta-cliente")).toHaveTextContent("Orçamento aprovado");
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Aprovar orçamento" })).not.toBeInTheDocument();
  });

  it("orçamento vencido: sem botões e com aviso para falar com a oficina", async () => {
    get.mockResolvedValue({ data: orcamentoPublico({ vencido: true, podeResponder: false }) });
    setup();
    expect(await screen.findByText(/Este orçamento venceu em 11\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar orçamento" })).not.toBeInTheDocument();
  });

  it("falar com a oficina: mostra o WhatsApp e abre a conversa com a mensagem pronta", async () => {
    get.mockResolvedValue({ data: orcamentoPublico({ oficina: { nome: "Oficina Boa", telefone: "1133334444", whatsapp: "11987654321" } }) });
    setup();
    const contato = await screen.findByTestId("contato-oficina");
    expect(within(contato).getByText("(11) 9 8765-4321")).toBeInTheDocument();
    const link = within(contato).getByRole("link", { name: /WhatsApp/ });
    expect(link).toHaveAttribute("href", `https://wa.me/5511987654321?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre o ORC #012 (ABC1D23).")}`);
  });

  it("sem WhatsApp, o contato liga para o telefone da oficina", async () => {
    get.mockResolvedValue({ data: orcamentoPublico({ oficina: { nome: "Oficina Boa", telefone: "1133334444", whatsapp: null } }) });
    setup();
    const contato = await screen.findByTestId("contato-oficina");
    expect(within(contato).getByText("(11) 3333-4444")).toBeInTheDocument();
    expect(within(contato).getByRole("link", { name: "Ligar para a oficina" })).toHaveAttribute("href", "tel:+551133334444");
  });

  it("link de OS não mostra os botões de resposta", async () => {
    get.mockResolvedValue({ data: orcamentoPublico({ type: "ordem", podeResponder: undefined }) });
    setup();
    expect(await screen.findByText("ORC #012")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar orçamento" })).not.toBeInTheDocument();
  });
});

describe("detalhe do orçamento: selo da resposta do cliente", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  const orcamento = (extra: object) => ({
    id: 12,
    descricao: "Revisão",
    valor: 350,
    data: "2026-11-04T00:00:00.000Z",
    validade: null,
    status: "aprovado",
    cliente: { id: 1, nome: "Ana" },
    veiculo: null,
    itens: [],
    ordens: [],
    ...extra,
  });

  const setup = () =>
    renderWithProviders(
      <MemoryRouter initialEntries={["/orcamentos/12"]}>
        <Routes>
          <Route path="/orcamentos/:id" element={<OrcamentoDetalhes />} />
        </Routes>
      </MemoryRouter>
    );

  it("aprovado pelo cliente: mostra data, hora (Brasília) e nome", async () => {
    get.mockResolvedValue({
      data: orcamento({ respondido_pelo_cliente: true, respondido_em: "2026-11-04T17:32:00.000Z", respondido_por_nome: "Ana" }),
    });
    setup();
    expect(await screen.findByTestId("selo-resposta-cliente")).toHaveTextContent("Aprovado pelo cliente em 04/11, 14:32 (Ana)");
  });

  it("recusado pelo cliente mostra o motivo", async () => {
    get.mockResolvedValue({
      data: orcamento({ status: "recusado", respondido_pelo_cliente: true, respondido_em: "2026-11-04T17:32:00.000Z", motivo_recusa: "Caro" }),
    });
    setup();
    expect(await screen.findByTestId("selo-resposta-cliente")).toHaveTextContent("Recusado pelo cliente em 04/11, 14:32. Motivo: Caro");
  });

  it("link para o cliente: gera o link, copia e monta o WhatsApp com o telefone do cliente", async () => {
    get.mockResolvedValue({ data: orcamento({ status: "analise", cliente: { id: 1, nome: "Ana Souza", telefone: "(11) 98765-4321" } }) });
    post.mockResolvedValue({ data: { code: CODE } });
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole("button", { name: "Link para o cliente" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/orcamentos/12/share"));
    const link = `${window.location.origin}/acompanhamento/${CODE}`;
    expect(await screen.findByTestId("link-cliente")).toHaveValue(link);

    const whatsapp = screen.getByRole("link", { name: "Enviar por WhatsApp" });
    const valor = (350).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const mensagem = `Olá Ana! Segue o orçamento #12 no valor de ${valor}. Você pode ver os detalhes e aprovar ou recusar por aqui: ${link}`;
    expect(whatsapp).toHaveAttribute("href", `https://wa.me/5511987654321?text=${encodeURIComponent(mensagem)}`);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith(link);
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  it("aprovado pela oficina não mostra selo", async () => {
    get.mockResolvedValue({ data: orcamento({ respondido_pelo_cliente: false }) });
    setup();
    expect(await screen.findByText("Orçamento #12")).toBeInTheDocument();
    expect(screen.queryByTestId("selo-resposta-cliente")).not.toBeInTheDocument();
  });
});
