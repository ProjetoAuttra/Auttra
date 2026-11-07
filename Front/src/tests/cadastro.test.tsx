import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import Cadastro from "../modules/autenticacao/pages/Cadastro";
import { lerCampanha, validarCadastro } from "../modules/autenticacao/cadastro";
import ConfirmarEmail from "../modules/autenticacao/pages/ConfirmarEmail";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
  turnstileSiteKey: "chave-teste",
  siteUrl: "https://site.teste",
}));

const turnstile = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock("../components/common/TurnstileWidget", () => ({
  default: React.forwardRef(function TurnstileFalso({ onVerify }: { onVerify: (t: string) => void }, ref) {
    React.useImperativeHandle(ref, () => ({ reset: turnstile.reset }));
    React.useEffect(() => onVerify("token-turnstile"), [onVerify]);
    return null;
  }),
}));

const auth = vi.hoisted(() => ({ isAuthenticated: false, signUp: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

function Onde() {
  const { pathname, state } = useLocation();
  return <div data-testid="onde">{pathname + (state ? JSON.stringify(state) : "")}</div>;
}

const abrir = (inicio = "/cadastro") =>
  renderWithProviders(
    <MemoryRouter initialEntries={[inicio]}>
      <Routes>
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/confirmar-email" element={<ConfirmarEmail />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>
  );

async function preencher(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Seu nome"), "Ana Souza");
  await user.type(screen.getByLabelText("Nome da oficina"), "Auto Center Ana");
  await user.type(screen.getByLabelText("WhatsApp"), "11988887777");
  await user.type(screen.getByLabelText("E-mail"), "ana@oficina.com");
  await user.type(screen.getByLabelText("Crie uma senha"), "segredo1");
  await user.click(screen.getByRole("checkbox"));
}

describe("validarCadastro e lerCampanha", () => {
  it("aponta cada campo faltando", () => {
    const erros = validarCadastro({ nome: "", oficina: "A", whatsapp: "(11) 9", email: "x@", senha: "123", aceite: false });
    expect(Object.keys(erros).sort()).toEqual(["aceite", "email", "nome", "oficina", "senha", "whatsapp"]);
    expect(validarCadastro({ nome: "Ana", oficina: "Oficina", whatsapp: "(11) 9 8888-7777", email: "a@b.co", senha: "123456", aceite: true })).toEqual({});
  });

  it("pega os UTMs da URL e os guarda para quem recarregar a página", () => {
    sessionStorage.clear();
    expect(lerCampanha(new URLSearchParams("utm_source=google&utm_campaign=lanc&outro=x"))).toEqual({ utm_source: "google", utm_campaign: "lanc" });
    expect(lerCampanha(new URLSearchParams(""))).toEqual({ utm_source: "google", utm_campaign: "lanc" });
    sessionStorage.clear();
    expect(lerCampanha(new URLSearchParams(""))).toBeNull();
  });
});

// Digita em cinco campos: com a suíte inteira rodando, passa dos 5s padrão.
describe("página de cadastro", { timeout: 30_000 }, () => {
  beforeEach(() => {
    sessionStorage.clear();
    auth.isAuthenticated = false;
    auth.signUp.mockReset();
    turnstile.reset.mockReset();
    vi.mocked(api.post).mockReset();
  });

  it("cria a conta com os dados limpos e os UTMs, e entra no app", async () => {
    const user = userEvent.setup();
    auth.signUp.mockResolvedValue(undefined);
    abrir("/cadastro?utm_source=instagram");

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Criar conta e começar o teste" }));

    expect(auth.signUp).toHaveBeenCalledWith({
      nome: "Ana Souza",
      oficina: "Auto Center Ana",
      whatsapp: "11988887777",
      email: "ana@oficina.com",
      senha: "segredo1",
      aceite_termos: true,
      turnstileToken: "token-turnstile",
      campanha: { utm_source: "instagram" },
      site: "",
    });
    expect(await screen.findByTestId("onde")).toHaveTextContent('/{"boasVindas":true}');
  });

  it("não envia sem aceitar os termos e mostra o que falta", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Criar conta e começar o teste" }));
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(screen.getByText("Informe o WhatsApp com DDD.")).toBeInTheDocument();
    expect(screen.getByText(/Para criar a conta, aceite os Termos de uso/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "https://site.teste/termos/");
  });

  it("e-mail que já tem conta: mostra a mensagem com atalhos para entrar e pede novo Turnstile", async () => {
    const user = userEvent.setup();
    auth.signUp.mockRejectedValue({
      response: { data: { code: "EMAIL_JA_CADASTRADO", message: "Esse e-mail já tem conta. Entre ou recupere a senha." } },
    });
    abrir();
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Criar conta e começar o teste" }));

    expect(await screen.findByText("Esse e-mail já tem conta. Entre ou recupere a senha.")).toBeInTheDocument();
    expect(turnstile.reset).toHaveBeenCalled();
    await user.click(screen.getByRole("link", { name: "Recuperar senha" }));
    expect(screen.getByTestId("onde")).toHaveTextContent('/login{"esqueciSenha":true}');
  });

  it("quem já está logado vai direto para o app", () => {
    auth.isAuthenticated = true;
    abrir();
    expect(screen.getByTestId("onde")).toHaveTextContent("/");
  });
});

describe("confirmação de e-mail", () => {
  beforeEach(() => {
    auth.isAuthenticated = false;
    vi.mocked(api.post).mockReset();
  });

  it("confirma pelo token do link", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: "E-mail confirmado." } });
    abrir("/confirmar-email?token=abc");
    expect(await screen.findByText("E-mail confirmado. Obrigado!")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/auth/confirmar-email", { token: "abc" });
    expect(screen.getByRole("link", { name: "Entrar no Auttra" })).toHaveAttribute("href", "/login");
  });

  it("link vencido mostra a mensagem do servidor; sem token nem chama", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { message: "Link de confirmação inválido ou expirado." } } });
    abrir("/confirmar-email?token=velho");
    expect(await screen.findByText("Link de confirmação inválido ou expirado.")).toBeInTheDocument();

    vi.mocked(api.post).mockReset();
    abrir("/confirmar-email");
    await waitFor(() => expect(screen.getByText("Link de confirmação inválido.")).toBeInTheDocument());
    expect(api.post).not.toHaveBeenCalled();
  });
});
