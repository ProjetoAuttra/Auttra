# CLAUDE.md — Driveon Backend

## O que é este projeto

**Driveon** é um sistema SaaS de gestão de oficinas mecânicas. O backend é uma API REST Express que serve o frontend React. É **multi-tenant**: cada operação é automaticamente escopada para a `oficina_id` do usuário autenticado via JWT.

O middleware `officeScopeMiddleware` injeta `oficina_id` em `req.query`, `req.params` e `req.body` antes de qualquer controller ser executado — nunca confie no `oficina_id` que vier do corpo da requisição diretamente.

---

## Stack e versões

| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 22 (Docker) | Runtime |
| TypeScript | 5.8.3 | Linguagem (strict mode ativo) |
| Express | 5.1.0 | Framework HTTP |
| Prisma | 6.17.1 | ORM + migrações |
| PostgreSQL | 16 | Banco de dados |
| JWT (jsonwebtoken) | 9.0.2 | Autenticação |
| bcrypt / bcryptjs | 6.0.0 / 3.0.2 | Hash de senhas |
| multer | 2.1.1 | Upload de arquivos (memoryStorage) |
| xml2js | 0.6.2 | Parse de XML de notas fiscais |
| pdfkit / puppeteer | 0.17.2 / 24.26.1 | Geração de PDFs |

---

## Estrutura de pastas

```
Back/
├── index.ts                    # Entry point — Express app, CORS, rotas, porta 4000
├── prisma/
│   ├── schema.prisma           # Fonte da verdade do banco — modifique aqui, rode migrate
│   ├── client.ts               # Exporta instância singleton do PrismaClient
│   └── migrations/             # Histórico de migrações SQL
├── scripts/
│   └── create-admin.mjs        # Seed: cria usuário admin e oficina inicial
└── src/
    ├── routes/
    │   └── index.ts            # Roteador central: aplica auth + escopo + permissões
    ├── controllers/            # Camada HTTP: lê req, chama service, escreve res
    ├── services/               # Lógica de negócio: valida, consulta Prisma, retorna dados
    ├── middlewares/
    │   ├── ensureAuth.ts       # authMiddleware + officeScopeMiddleware + requirePermission
    │   └── errorHandler.ts     # Handler global de erros Express
    ├── permissions/
    │   └── accessProfiles.ts   # Definição de módulos e ações do RBAC
    └── types/
        └── index.d.ts          # Declarações globais (ex: req.user)
```

---

## Arquitetura: fluxo de uma requisição

```
Cliente HTTP
    ↓
authMiddleware          (valida JWT, injeta req.user)
    ↓
officeScopeMiddleware   (injeta req.user.oficina_id em query/params/body)
    ↓
modulePermission()      (verifica se o perfil tem acesso ao módulo)
    ↓
Controller              (lê req, chama service, serializa res)
    ↓
Service                 (regras de negócio, consultas Prisma)
    ↓
Prisma                  (banco PostgreSQL)
```

---

## Middleware de autenticação (`ensureAuth.ts`)

### `authMiddleware`
Valida o Bearer token JWT. Em caso de falha, retorna 401. Injeta `req.user`:
```typescript
req.user = { id, nome, email, tipo, oficina_id, perfil_acesso_id, permissoes }
```

### `officeScopeMiddleware`
Injeta `oficina_id` do token em todos os pontos de entrada da requisição para garantir isolamento de dados.

### `getRequiredOfficeId(req)`
Helper usado em todos os controllers:
```typescript
const oficinaId = getRequiredOfficeId(req);
// lança erro se oficina_id não estiver presente
```

### `modulePermission(modulo)`
Middleware que verifica se o usuário tem acesso ao módulo antes do controller:
```typescript
router.use("/clientes", modulePermission("clientes"), clientesRouter);
```

---

## Padrão de rotas (`routes/index.ts`)

Todas as rotas (exceto `/auth`) passam por `authMiddleware` + `officeScopeMiddleware`:

```typescript
router.use("/clientes",      modulePermission("clientes"),      clientesRouter);
router.use("/ordens",        modulePermission("ordens"),        ordensRouter);
router.use("/estoque",       modulePermission("estoque"),       estoqueRouter);
router.use("/pecas",         modulePermission("estoque"),       pecasRouter);
router.use("/importarxml",   modulePermission("estoque"),       importacaoXmlRouter);
router.use("/cidade",        cidadeRouter); // sem permissão específica de módulo
```

---

## Padrão de controllers

```typescript
export const MeuController = {
  async list(req: Request, res: Response) {
    try {
      const result = await MeuService.list(getRequiredOfficeId(req));
      return res.json(result);
    } catch (error) {
      console.error("Erro ao listar:", error);
      res.status(500).json({ error: "Erro interno" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const novo = await MeuService.create({
        ...req.body,
        oficina_id: getRequiredOfficeId(req),
      });
      return res.status(201).json(novo);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },
};
```

**Regras:**
- Sempre use `getRequiredOfficeId(req)` — nunca `req.body.oficina_id` diretamente
- Erros de negócio (validação) → `status 400` com `{ message }`
- Erros internos (DB, runtime) → `status 500` com `{ error }`
- Operações de listagem → `200 + json(array)`
- Criação bem-sucedida → `201 + json(objeto)`
- Exclusão bem-sucedida → `204` (sem body)

---

## Padrão de services

```typescript
export const MeuService = {
  async list(oficina_id: number) {
    return prisma.meuModelo.findMany({
      where: { oficina_id, deleted_at: null },
      orderBy: { created_at: "desc" },
    });
  },

  async create(data: MeuInput) {
    // validações de negócio aqui
    if (!data.nome) throw new Error("Nome é obrigatório.");
    return prisma.meuModelo.create({ data });
  },

  async delete(id: number, oficina_id: number) {
    // verificar se pertence à oficina antes de deletar
    const item = await prisma.meuModelo.findFirst({ where: { id, oficina_id, deleted_at: null } });
    if (!item) throw new Error("Não encontrado.");
    return prisma.meuModelo.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },
};
```

---

## Banco de dados (Prisma)

### Modelos principais

| Modelo | Descrição |
|---|---|
| `usuario` | Usuário de sistema (tipo: funcionario, cliente, gestoroficina, sistema) |
| `oficina` | Tenant principal — todo dado pertence a uma oficina |
| `cliente` | Clientes da oficina |
| `funcionario` | Mecânicos e atendentes |
| `veiculo` | Veículos vinculados a clientes |
| `ordem_servico` | Ordens de serviço (status: aberta, em_andamento, concluida, cancelada) |
| `item_ordem_servico` | Itens de uma OS (tipo: servico ou peca) |
| `servico` | Catálogo de mão de obra |
| `peca` | **Modelo canônico de estoque** — use este, não `estoque` |
| `estoque` | Legado, não usado. Mantido no schema por compatibilidade |
| `pagamento` | Contas a pagar e receber (tipo: pagar / receber) |
| `orcamento` | Orçamentos (status: analise, aprovado, recusado) |
| `agendamento` | Agenda da oficina |
| `fornecedor` | Fornecedores de peças |
| `compra_peca` | Histórico de compras de peças (requer `fornecedor_id` não nulo) |
| `nota_fiscal_importada` | NF-e importadas via XML (unique: oficina_id + chave_acesso) |
| `cidade` | Cidades (id interno, não IBGE) — `POST /cidade` é findOrCreate |
| `perfil_acesso` | Perfis RBAC customizáveis por oficina |

### Soft deletes

Todos os modelos principais usam `deleted_at: DateTime?`. Sempre filtre com:
```typescript
where: { deleted_at: null }
```

### Convenção de campos de data

- `created_at` / `updated_at` — automáticos via Prisma (`@default(now())` / `@updatedAt`)
- `deleted_at` — soft delete manual
- `criado_em` — usado em `cliente` (inconsistência histórica; novos modelos usam `created_at`)

### Transações

Para operações atômicas (ex: importação de NF-e):
```typescript
await prisma.$transaction(async (tx: any) => {
  const nota = await tx.nota_fiscal_importada.create({ data: ... });
  await tx.peca.update({ where: { id }, data: { estoque: { increment: qtd } } });
});
```

### `cidade` — findOrCreate

O `POST /cidade` retorna a cidade existente se já cadastrada (não lança erro de duplicata):
```typescript
const existing = await prisma.cidade.findFirst({ where: { nome, uf } });
if (existing) return existing;
return prisma.cidade.create({ data: { nome, uf } });
```

---

## Recursos adicionais por oficina

Oficinas podem habilitar/desabilitar módulos via `recursos_adicionais` (JSON no modelo `oficina`):
- `agenda` — Agendamentos
- `estoque` — Peças, estoque e importação XML
- `fornecedores` — Cadastro de fornecedores

Isso controla visibilidade no frontend e acesso às rotas.

---

## Autenticação JWT

```
POST /api/auth/login
  body: { email, senha }
  → { token, usuario } ou { requiresOfficeSelection: true, selectionToken, oficinas }

POST /api/auth/select-oficina
  body: { selectionToken, oficina_id }
  → { token, usuario }
```

Token expira em 8 horas. Contém: `id, nome, email, tipo, oficina_id, perfil_acesso_id, permissoes`.

---

## Upload de arquivos (XML)

Usa `multer` com `memoryStorage` — arquivos ficam em `req.file.buffer`, sem escrita em disco:
```typescript
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post("/preview", upload.single("arquivo"), ImportacaoXmlController.preview);
```

---

## Ajuste de estoque

`PATCH /pecas/:id/ajuste` — endpoint atômico para entrada/saída:
```typescript
// body: { tipo: "entrada" | "saida", quantidade: number }
// valida: quantidade > 0, estoque suficiente para saída
// usa: { estoque: { increment | decrement: quantidade } }
```

---

## Regras — o que fazer

- **Sempre** use `getRequiredOfficeId(req)` nos controllers
- **Sempre** filtre por `deleted_at: null` em queries de listagem
- **Sempre** valide que o recurso pertence à `oficina_id` antes de atualizar ou deletar
- **Sempre** use `modulePermission("modulo")` no roteador ao criar nova rota
- **Sempre** use `prisma.$transaction()` para operações que modificam múltiplas tabelas
- **Sempre** use `peca` (não `estoque`) como modelo canônico de inventário
- **Sempre** use `cidade.service.ts` findOrCreate ao vincular fornecedor/oficina a cidade
- **Sempre** adicione `@@index([oficina_id])` e `@@index([deleted_at])` em novos modelos

## Regras — o que não fazer

- **Nunca** confie no `oficina_id` do corpo da requisição — use `getRequiredOfficeId(req)`
- **Nunca** faça delete físico (`prisma.X.delete`) em modelos com `deleted_at` — use soft delete
- **Nunca** acesse o modelo `estoque` para operações de inventário — use `peca`
- **Nunca** crie `compra_peca` sem verificar que `fornecedor_id` é não-nulo (FK obrigatória)
- **Nunca** exponha senhas ou JWT_SECRET em logs
- **Nunca** use `import.meta.env` — é Vite (frontend). No backend use `process.env`
- **Nunca** esqueça de regenerar o Prisma Client após alterar o schema: `npx prisma generate`

---

## Inconsistências conhecidas (não implementar sem discutir)

| # | Problema | Localização |
|---|---|---|
| 1 | Botão "Editar OS" no frontend faz apenas `alert()` | Frontend: `modules/tarefas/pages/detalhesos/` |
| 2 | Concluir OS não cria Conta a Receber automaticamente | `services/ordens.service.ts` — sem hook pós-conclusão |
| 3 | Conversão de Orçamento → OS usa `funcionarios[0]` sem seleção | `services/orcamentos.service.ts` |
| 4 | `item_ordem_servico` com `tipo=peca` não desconta `peca.estoque` | Integração ordens ↔ pecas inexistente no service |
| 5 | `agendamento` não tem campo `ordem_servico_id` — módulos sem vínculo | Schema + `services/agendamento.service.ts` |
| 6 | `ordem_servico` não expõe status de pagamento na listagem | `services/ordens.service.ts` — sem join em `pagamento` |
| 7 | `LIMITE_BAIXO = 3` fixo no frontend — sem campo `estoque_minimo` na `peca` | Schema `peca` não tem `estoque_minimo` |
| 8 | Pagamento parcial não modelado — `pagamento.status` só tem pendente/pago/cancelado | Schema `pagamento` + `services/pagamentos.service.ts` |

---

## Variáveis de ambiente

```
DATABASE_URL=postgresql://user:pass@host:5432/driveon?schema=public
JWT_SECRET=chave-secreta-forte
CORS_ORIGIN=http://localhost:8080,http://localhost:5173
PORT=4000
```

---

## Como rodar localmente

```bash
cd Back
npm install
npx prisma migrate dev     # aplica migrações (requer DATABASE_URL)
npx prisma generate        # OBRIGATÓRIO após alterar schema.prisma
npm run dev                # ts-node-dev ou similar
```

Via Docker (recomendado):
```bash
docker compose up --build -d
# API disponível em http://localhost:4000
```

Criar admin inicial:
```bash
docker compose exec api node scripts/create-admin.mjs
```

## Migrations

- **Nunca** edite arquivos em `prisma/migrations/` manualmente em dev
- Se não tiver `DATABASE_URL` local, crie o SQL manualmente em `migrations/TIMESTAMP_descricao/migration.sql`
- Após qualquer alteração no schema, rode `npx prisma generate` no container para regenerar o client
