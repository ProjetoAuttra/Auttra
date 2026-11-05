import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/api";

/** Faz a API responder 401 com a mensagem dada, sem rede. */
function responder401(message: string) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError("401", "ERR_BAD_REQUEST", config, null, {
      status: 401,
      statusText: "Unauthorized",
      data: { message },
      headers: {},
      config: { ...config, headers: new AxiosHeaders(config.headers) },
    });
  };
}

describe("sessão inválida volta para o login", () => {
  const adapterOriginal = api.defaults.adapter;
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, pathname: "/orcamentos", assign } as Location);
  });

  afterEach(() => {
    api.defaults.adapter = adapterOriginal;
  });

  const logado = () => {
    localStorage.setItem("driveon:token", "token-vencido");
    localStorage.setItem("driveon:user", "{}");
  };

  it("token vencido: limpa o login salvo e vai para a tela de entrada", async () => {
    logado();
    responder401("Token inválido");
    await expect(api.get("/orcamentos")).rejects.toBeTruthy();
    expect(localStorage.getItem("driveon:token")).toBeNull();
    expect(localStorage.getItem("driveon:user")).toBeNull();
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("sessão encerrada no servidor (senha trocada) também volta para o login", async () => {
    logado();
    responder401("Sessão encerrada. Faça login novamente.");
    await expect(api.get("/orcamentos")).rejects.toBeTruthy();
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("senha errada no login não mexe em nada: o erro fica com a tela", async () => {
    logado();
    responder401("Email ou senha invalidos.");
    await expect(api.post("/auth/login", {})).rejects.toBeTruthy();
    expect(localStorage.getItem("driveon:token")).toBe("token-vencido");
    expect(assign).not.toHaveBeenCalled();
  });

  it("sem token salvo não redireciona (páginas públicas)", async () => {
    responder401("Token inválido");
    await expect(api.get("/orcamentos")).rejects.toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });
});
