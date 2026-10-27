import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/api";
import { useListaPaginada } from "../hooks/useListaPaginada";

vi.mock("../api/api", () => ({ default: { get: vi.fn() } }));

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const resposta = (rows: unknown[], total: number) => ({ data: rows, headers: { "x-total-count": String(total) } });

describe("useListaPaginada", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue(resposta([{ id: 1 }], 25));
  });

  it("pede a primeira página e lê o total do header", async () => {
    const { result } = renderHook(() => useListaPaginada("/clientes"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(get).toHaveBeenCalledWith("/clientes", { params: { page: 1, limit: 10 } });
    expect(result.current.total).toBe(25);
    expect(result.current.rows).toEqual([{ id: 1 }]);
  });

  it("muda de página e de tamanho (voltando à primeira)", async () => {
    const { result } = renderHook(() => useListaPaginada("/clientes"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/clientes", { params: { page: 3, limit: 10 } }));

    act(() => result.current.setRowsPerPage(20));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/clientes", { params: { page: 1, limit: 20 } }));
  });

  it("aplica filtros com debounce, omite vazios/'todos' e volta à página 1", async () => {
    const { result, rerender } = renderHook(({ f }) => useListaPaginada("/orcamentos", { filtros: f, debounceMs: 20 }), {
      initialProps: { f: { search: "", status: "todos" } as Record<string, string> },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(1));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/orcamentos", { params: { page: 2, limit: 10 } }));

    rerender({ f: { search: "gol", status: "aprovado" } });
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith("/orcamentos", { params: { search: "gol", status: "aprovado", page: 1, limit: 10 } })
    );
  });

  it("recarregar refaz a consulta", async () => {
    const { result } = renderHook(() => useListaPaginada("/clientes"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const chamadas = get.mock.calls.length;
    act(() => result.current.recarregar());
    await waitFor(() => expect(get.mock.calls.length).toBe(chamadas + 1));
  });
});
