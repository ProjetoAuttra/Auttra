# CLAUDE.md — Driveon Frontend

## O que é este projeto

**Driveon** é um sistema SaaS de gestão de oficinas mecânicas. O frontend é uma SPA React que consome a API REST do backend Express. O usuário final típico é um mecânico ou recepcionista de oficina — priorize UX simples, poucos cliques e feedback visual imediato.

O sistema é **multi-tenant**: cada usuário pertence a uma ou mais oficinas (`oficina_id`). Toda requisição carrega o contexto da oficina selecionada via JWT.

---

## Stack e versões

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 19.1.1 | Framework base |
| TypeScript | 5.9.3 | Tipagem (strict mode ativo) |
| Vite | 7.1.2 | Build e dev server |
| Material UI | 7.3.2 | Componentes de UI (usa `Grid` com prop `size`, não `xs/md`) |
| MUI Icons | 7.3.2 | Ícones (sempre sufixo `Rounded` ou `Outlined`) |
| react-router-dom | 7.8.2 | Roteamento |
| Axios | 1.11.0 | Cliente HTTP |
| react-hook-form | 7.62.0 | Formulários (usado em alguns módulos, ainda não universal) |
| Zod | 4.1.5 | Validação de schema (usado com RHF em alguns módulos) |
| notistack | 3.0.2 | Toasts/notificações (via `useToast`) |
| dayjs | 1.11.18 | Datas |

---

## Estrutura de pastas

```
Front/src/
├── api/
│   └── api.ts              # Cliente Axios principal — SEMPRE use este, não o lib/http.ts
├── app/
│   ├── Router.tsx          # Todas as rotas. ModuleRoute faz guarda de permissões
│   ├── AppLayout.tsx       # Layout global (sidebar + topbar + outlet)
│   ├── providers.tsx       # Todos os providers em cascata
│   └── theme.tsx           # Tema MUI
├── components/
│   ├── common/
│   │   ├── EmptyState.tsx         # Estado vazio padronizado
│   │   ├── ListTableContainer.tsx # Wrapper de tabelas com borda e scroll
│   │   └── TableSkeleton.tsx      # Skeleton de carregamento
│   ├── form/
│   │   ├── RHFTextField.tsx       # TextField integrado ao react-hook-form
│   │   ├── RHFSelect.tsx
│   │   └── RHFDatePicker.tsx
│   ├── layout/
│   │   ├── AppSidebar.tsx         # Menu lateral com RBAC e recursos adicionais
│   │   ├── AppTopbar.tsx
│   │   └── ModuleHeader.tsx       # Header padrão de módulo (título, métricas, ação)
│   └── styled/
│       └── DialogStyles.tsx       # HeaderIcon, SectionLabel reutilizáveis
├── context/
│   ├── AuthContext.tsx     # user, token, signIn, signOut, can()
│   ├── ToastContext.tsx    # success(), error(), warning()
│   ├── ConfirmContext.tsx  # confirm() — dialog de confirmação assíncrono
│   ├── SidebarContext.tsx  # collapsed state do sidebar
│   └── AdditionalResourcesContext.tsx  # agenda/estoque/fornecedores habilitados
├── hooks/
│   └── useCep.ts           # Busca CEP no ViaCEP, retorna { buscar, loading, erro }
├── modules/                # Um diretório por funcionalidade
│   ├── autenticacao/
│   ├── painel/             # Dashboard
│   ├── agenda/
│   ├── clientes/
│   ├── tarefas/            # Ordens de Serviço (URL: /tarefas)
│   ├── veiculos/
│   ├── estoque/
│   ├── servicos/
│   ├── fornecedores/
│   ├── pagamentos/
│   ├── orcamentos/
│   ├── usuarios/
│   ├── configuracoes/
│   ├── recursos-adicionais/
│   └── relatorios/
├── permissions/
│   └── accessProfiles.ts   # Módulos e ações do RBAC (espelho do backend)
├── routes/
│   └── paths.ts            # Constantes de rotas — sempre use paths.X, nunca string literal
└── types/                  # Tipos globais compartilhados
```

### Estrutura padrão de um módulo

```
modules/feature/
├── pages/
│   └── Feature.tsx         # Página principal
├── dialog/
│   └── index.tsx           # Dialog de criação/edição
└── api/
    └── api.ts              # Funções de API do módulo
```

---

## Padrões de código

### Cliente HTTP

Use sempre `src/api/api.ts`. Há também `src/lib/http.ts` (legado), mas o padrão corrente é `api/api.ts`.

```typescript
import api from "../../../api/api";

const res = await api.get("/clientes");
const res = await api.post("/pecas", payload);
```

O cliente injeta automaticamente o Bearer token do `localStorage` ou `sessionStorage`.

### Autenticação e oficina

```typescript
const { user } = useAuth();
const oficinaId = user?.oficina_id ?? 0;
```

O `user` vem do JWT decodificado. `oficina_id` identifica a oficina ativa.

### Verificação de permissão

```typescript
const { can } = useAuth();
if (can("estoque", "create")) { ... }
```

No roteador, use `ModuleRoute`:
```tsx
<Route path={paths.estoque} element={<ModuleRoute module="estoque"><EstoquePage /></ModuleRoute>} />
```

### Notificações

```typescript
const { success, error, warning } = useToast();
success("Peça salva!");
error("Não foi possível salvar.");
```

### Confirmação de ações destrutivas

```typescript
const confirm = useConfirm();
const ok = await confirm({
  title: "Excluir cliente?",
  message: "Esta ação não pode ser desfeita.",
  confirmLabel: "Sim, excluir",
  variant: "danger",
});
if (!ok) return;
```

### Rotas

Sempre use as constantes de `paths.ts`:
```typescript
import { paths } from "../../../routes/paths";
navigate(paths.clientes);
navigate(`/clientes/${id}`); // para rotas dinâmicas
```

### Formulários em dialogs (padrão atual)

A maioria dos dialogs usa estado local simples, não RHF:
```typescript
const [form, setForm] = React.useState<MeuForm>({ nome: "", ... });
const handleChange = (field: keyof MeuForm, value: string) =>
  setForm(prev => ({ ...prev, [field]: value }));
```

Novos formulários complexos devem usar `react-hook-form` + `zod` (ver `modules/tarefas/dialog/`).

### Tabelas

Use `ListTableContainer` + `Table` do MUI. Padrão de colunas: dados principais à esquerda, ações à direita com `IconButton` + `MoreVertRoundedIcon` abrindo `Menu`.

```tsx
<ListTableContainer>
  <Table stickyHeader>
    <TableHead>...</TableHead>
    <TableBody>
      {rows.map(row => (
        <TableRow key={row.id} hover sx={{ cursor: "pointer" }}
          onDoubleClick={() => navigate(`/modulo/${row.id}`)}>
          ...
          <TableCell align="right">
            <IconButton onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, row.id); }}>
              <MoreVertRoundedIcon />
            </IconButton>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ListTableContainer>
```

### Dialogs

Use o padrão de header colorido com `alpha(primary.main, 0.06-0.10)`:
```tsx
<Paper elevation={0} square sx={{
  px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
  bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
}}>
  <Stack direction="row" spacing={1.25} alignItems="center">
    <HeaderIcon><IconeRoundedIcon /></HeaderIcon>
    <Typography variant="subtitle1" fontWeight={800}>Título</Typography>
  </Stack>
  <IconButton onClick={onClose}><CloseRoundedIcon /></IconButton>
</Paper>
```

`HeaderIcon` e `SectionLabel` vêm de `components/styled/DialogStyles.tsx`.

### Soft delete visual

Ao excluir da lista local, use `setRows(prev => prev.filter(r => r.id !== id))` — nunca recarregue a lista toda.

### Grid (MUI v7)

MUI 7 usa prop `size` no `Grid`, não `xs`/`md`:
```tsx
<Grid size={12}>          // equivale a xs={12}
<Grid size={{ xs: 12, md: 6 }}>  // responsivo
```

### CEP auto-fill

Use o hook `useCep` para qualquer formulário de endereço:
```typescript
const { buscar, loading, erro } = useCep();
// chama buscar("01310100") quando CEP tem 8 dígitos
// retorna { logradouro, bairro, cidade, uf }
// depois faz POST /cidade para obter cidade_id
```

---

## Regras — o que fazer

- **Sempre** use `useToast()` para feedback de ações (nunca `alert()`)
- **Sempre** use `useConfirm()` antes de excluir
- **Sempre** trate erros com `try/catch` e chame `error()` no toast
- **Sempre** adicione `e.stopPropagation()` no clique do 3-pontos quando a linha tem double-click
- **Sempre** use `paths.X` de `routes/paths.ts` para navegar
- **Sempre** use `getRequiredOfficeId(req)` no backend (não `req.body.oficina_id` diretamente)
- **Sempre** use `ListTableContainer` para tabelas
- **Sempre** use `ModuleRoute` ao adicionar nova rota

## Regras — o que não fazer

- **Nunca** use `alert()` — use `useToast()`
- **Nunca** use string literals de rota — use `paths.X`
- **Nunca** importe de `lib/http.ts` em módulos novos — use `api/api.ts`
- **Nunca** faça requisições com `oficina_id` hardcoded — leia de `user.oficina_id`
- **Nunca** adicione campos de `status` em clientes (foi removido intencionalmente da UI; o banco tem default)
- **Nunca** crie dois clientes HTTP paralelos para o mesmo recurso
- **Nunca** use `console.log` em produção — use apenas `console.error` em catch blocks
- **Nunca** faça reload da página para atualizar estado — use `setRows` local

---

## Variáveis de ambiente

```
VITE_API_URL=http://localhost:4000/api   # URL da API em dev
```

Em produção, a URL da API é injetada via `window.__DRIVEON_CONFIG__.API_URL` pelo nginx entrypoint.

---

## Como rodar localmente

```bash
cd Front
npm install
npm run dev        # inicia em http://localhost:5173, proxy /api -> localhost:5080
```

Via Docker (recomendado):
```bash
docker compose up --build -d web
# acessa em http://localhost:8080
```
