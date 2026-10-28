import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import ClientDialog, { type Client } from "../modules/clientes/dialog";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));

// O calendário próprio é testado à parte (campo-data.test.tsx).
vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe("ClientDialog (painel lateral)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof ClientDialog>> = {}) => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const onDelete = vi.fn();
    renderWithProviders(<ClientDialog open mode="create" onClose={onClose} onSubmit={onSubmit} onDelete={onDelete} {...props} />);
    return { onSubmit, onClose, onDelete, user: userEvent.setup() };
  };

  it("abre com o título, as seções e o botão de cadastrar", () => {
    setup();
    expect(screen.getByText("Novo cliente")).toBeInTheDocument();
    expect(screen.getByText("Dados do cliente")).toBeInTheDocument();
    expect(screen.getByText("Endereço")).toBeInTheDocument();
    expect(screen.getByText("Observações", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cadastrar cliente/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir cliente/i })).toBeNull();
  });

  it("sem nome não envia e mostra o erro", async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole("button", { name: /cadastrar cliente/i }));
    expect(await screen.findByText("Informe o nome do cliente")).toBeInTheDocument();
    expect(screen.getByText(/corrija os campos destacados/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("e-mail e CPF inválidos bloqueiam o envio", async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText(/nome \/ razão social/i), "Ana");
    await user.type(screen.getByLabelText(/e-mail/i), "ana@");
    await user.type(screen.getByLabelText(/cpf\/cnpj/i), "111.111.111-11");
    await user.click(screen.getByRole("button", { name: /cadastrar cliente/i }));
    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
    expect(screen.getByText("CPF/CNPJ inválido")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envia os dados limpos (nome aparado, telefone só com dígitos) e fecha", async () => {
    const { onSubmit, onClose, user } = setup();
    await user.type(screen.getByLabelText(/nome \/ razão social/i), "  Ana Costa  ");
    await user.type(screen.getByLabelText(/telefone/i), "11987654321");
    await user.type(screen.getByLabelText("Observações"), "Cliente antigo");
    await user.click(screen.getByRole("button", { name: /cadastrar cliente/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Ana Costa", telefone: "11987654321", observacao: "Cliente antigo", email: undefined, cpf: undefined })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("na edição mostra o nome no cabeçalho e exclui só depois de confirmar", async () => {
    const initial: Client = { id: "7", nome: "Carlos Almeida", email: "carlos@email.com" };
    const { onDelete, user } = setup({ mode: "edit", initial });
    expect(screen.getByText("Editar cliente")).toBeInTheDocument();
    expect(screen.getByText("Carlos Almeida", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar alterações/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /excluir cliente/i }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /sim, excluir/i }));
    expect(onDelete).toHaveBeenCalledWith(initial);
  });
});
