import api from "../../../api/api";
import type { Client, ClientForm } from "../dialog";

/** Cadastra o cliente com tudo o que o ClientDialog coleta (inclusive endereço). */
export async function criarCliente(data: ClientForm, oficinaId: number): Promise<Client> {
  const payload = {
    nome: data.nome,
    email: data.email || null,
    cpf: data.cpf || null,
    telefone: data.telefone || null,
    data_nascimento: data.data_nascimento ? new Date(data.data_nascimento).toISOString() : null,
    observacao: data.observacao || null,
    cep: data.cep || null,
    logradouro: data.logradouro || null,
    numero: data.numero || null,
    complemento: data.complemento || null,
    cidade_id: data.cidade_id ?? null,
    oficina_id: oficinaId,
  };
  const { data: c } = await api.post("/clientes", payload);
  return { id: String(c.id), nome: c.nome, email: c.email, cpf: c.cpf, telefone: c.telefone, observacao: c.observacao };
}
