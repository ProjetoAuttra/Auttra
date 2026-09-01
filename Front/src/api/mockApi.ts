import MockAdapter from 'axios-mock-adapter';
import api from '../api/api';

const mock = new MockAdapter(api, { delayResponse: 500 });

// Mock Users
const mockUser = {
  id: 1,
  email: "admin@admin.com",
  nome: "Admin Test",
  tipo: "admin",
  oficina_id: 1
};

mock.onPost('/auth/verify-email').reply(200, {
  emailToken: 'mock-email-token'
});

mock.onPost('/auth/login').reply(200, {
  token: 'mock-test-token-123',
  usuario: mockUser
});

// Mock Clients
const mockClients = [
  { id: 1, nome: "João Silva", cpfCnpj: "111.222.333-44", telefone: "(11) 98888-7777", email: "joao@example.com" },
  { id: 2, nome: "Maria Oliveira", cpfCnpj: "222.333.444-55", telefone: "(11) 97777-6666", email: "maria@example.com" },
  { id: 3, nome: "Auto Peças Central", cpfCnpj: "12.345.678/0001-90", telefone: "(11) 3333-4444", email: "contato@central.com" }
];

mock.onGet('/clientes').reply(200, mockClients);
mock.onPost('/clientes').reply(201, mockClients[0]);
mock.onPut(/\/clientes\/\d+/).reply(200, mockClients[0]);
mock.onDelete(/\/clientes\/\d+/).reply(200, { message: "Excluído com sucesso" });

// Mock Vehicles
const mockVehicles = [
  { id: 1, placa: "ABC-1234", modelo: "Forte", marca: "Ford", ano: 2020, clienteId: 1 },
  { id: 2, placa: "XYZ-9876", modelo: "Corolla", marca: "Toyota", ano: 2022, clienteId: 2 }
];

mock.onGet('/veiculos').reply(200, mockVehicles);
mock.onGet(/\/veiculos\/cliente\/\d+/).reply(200, mockVehicles);

// Mock Services
const mockServices = [
  { id: 1, nome: "Troca de Óleo", preco: 150.00, duracaoEstimada: 30 },
  { id: 2, nome: "Alinhamento e Balanceamento", preco: 200.00, duracaoEstimada: 60 }
];

mock.onGet('/servicos').reply(200, mockServices);

// Mock Suppliers
const mockSuppliers = [
  { id: 1, nomeFantasia: "Distribuidora XPTO", cnpj: "98.765.432/0001-10", telefone: "(11) 4444-5555" }
];

mock.onGet('/fornecedores').reply(200, mockSuppliers);

// Expand this as needed for the other entities like scheduling, tasks, etc.

export default mock;
