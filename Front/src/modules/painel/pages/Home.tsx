import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, ListItemIcon, Menu, MenuItem, Skeleton, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";

import DialogCarro from "../../veiculos/dialog/";
import DialogCliente from "../../clientes/dialog/";
import { useAuth } from "../../../context/AuthContext";
import { useAdditionalResources } from "../../../context/AdditionalResourcesContext";
import api from "../../../api/api";
import { brand } from "../../../app/theme";
import { paths } from "../../../routes/paths";
import { GraficoColunas } from "../../relatorios/shared/graficos";
import { brl } from "../../relatorios/shared/reportUtils";

const INK   = brand.ink;
const MUTED = brand.muted;

// ─── Resposta de GET /painel/resumo (blocos sem permissão chegam como null) ───

type ChaveAtencao = "ordens_paradas" | "contas_vencidas" | "orcamentos_sem_resposta" | "estoque_critico" | "contas_pagar_amanha";

interface Resumo {
  financeiro: {
    faturamento_mes: number;
    variacao_percentual: number | null;
    dias: { data: string; total: number }[];
    a_receber_hoje: number;
    a_receber_vencido: number;
    a_pagar_semana: number;
    contas_pagar_amanha: number;
  } | null;
  atencao: { chave: ChaveAtencao; quantidade: number; valor?: number; dias?: number }[];
  agenda: {
    total: number;
    itens: { id: number; inicio: string; titulo: string; status: string; cliente: string; veiculo: string }[];
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saudacao(nome: string): string {
  const h = new Date().getHours();
  const turno = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${turno}, ${nome.split(" ")[0]}`;
}

function hojeLabel(): string {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

const plural = (n: number, singular: string, plur: string) => (n === 1 ? singular : plur);
const rotuloDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function linhaAtencao(a: Resumo["atencao"][number]): { titulo: string; detalhe: string; to: string } {
  const q = a.quantidade;
  switch (a.chave) {
    case "ordens_paradas":
      return { titulo: `${q} ${plural(q, "O.S. parada", "O.S. paradas")} há mais de 5 dias`, detalhe: `a mais antiga: ${a.dias} dias`, to: paths.tasks };
    case "contas_vencidas":
      return { titulo: `${q} ${plural(q, "conta vencida", "contas vencidas")} a receber`, detalhe: brl(a.valor ?? 0), to: paths.contasReceber };
    case "orcamentos_sem_resposta":
      return { titulo: `${q} ${plural(q, "orçamento sem resposta", "orçamentos sem resposta")}`, detalhe: "em análise há mais de 3 dias", to: paths.orcamentos };
    case "estoque_critico":
      return { titulo: `${q} ${plural(q, "item", "itens")} com estoque crítico`, detalhe: "3 unidades ou menos", to: paths.estoque };
    case "contas_pagar_amanha":
      return { titulo: `${q} ${plural(q, "conta a pagar vence", "contas a pagar vencem")} amanhã`, detalhe: brl(a.valor ?? 0), to: paths.contasPagar };
  }
}

function Section({ title, to, children }: { title: string; to?: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{title}</Typography>
        {to && (
          <Typography
            component="button"
            onClick={() => navigate(to)}
            sx={{ fontSize: 13, color: brand.primary, background: "none", border: 0, p: 0, cursor: "pointer", fontFamily: "inherit", "&:hover": { textDecoration: "underline" } }}
          >
            Ver tudo
          </Typography>
        )}
      </Stack>
      {children}
    </Box>
  );
}

const rowSx = {
  display: "flex", alignItems: "center", gap: 2, py: 1.5, width: "100%", textAlign: "left",
  border: 0, borderBottom: `1px solid ${brand.line}`, background: "transparent",
  fontFamily: "inherit", color: INK, fontSize: 15,
} as const;

function Vazio({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ py: 2, fontSize: 14, color: MUTED }}>{children}</Typography>;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, can } = useAuth();
  const { isEnabled } = useAdditionalResources();
  const navigate = useNavigate();

  const [resumo,  setResumo]  = React.useState<Resumo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [erro,    setErro]    = React.useState(false);

  const [openCliente, setOpenCliente] = React.useState(false);
  const [openVeiculo, setOpenVeiculo] = React.useState(false);
  const [menuEl,      setMenuEl]      = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data } = await api.get<Resumo>("/painel/resumo");
        if (ativo) setResumo(data);
      } catch (err) {
        console.error("Erro ao carregar o resumo do painel:", err);
        if (ativo) setErro(true);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  const novos = [
    { icon: <AssignmentRoundedIcon fontSize="small" />,    label: "Nova O.S.",         onClick: () => navigate(paths.ordemNova) },
    { icon: <RequestQuoteRoundedIcon fontSize="small" />,  label: "Novo orçamento",    onClick: () => navigate(paths.orcamentoNovo) },
    { icon: <PersonAddRoundedIcon fontSize="small" />,     label: "Cadastrar cliente", onClick: () => setOpenCliente(true) },
    { icon: <DirectionsCarRoundedIcon fontSize="small" />, label: "Cadastrar veículo", onClick: () => setOpenVeiculo(true) },
  ];

  const veFinanceiro = can("financeiro");
  const veAgenda     = can("agenda") && isEnabled("agenda");
  const veAtencao    = can("ordens") || can("financeiro") || can("orcamentos") || (can("estoque") && isEnabled("estoque"));

  const fin = resumo?.financeiro ?? null;
  const financeiroCards = fin && [
    {
      label: "A receber hoje",
      valor: fin.a_receber_hoje,
      detalhe: fin.a_receber_vencido > 0 ? `${brl(fin.a_receber_vencido)} vencido` : "nada vencido",
      to: paths.contasReceber,
    },
    {
      label: "A pagar esta semana",
      valor: fin.a_pagar_semana,
      detalhe: fin.contas_pagar_amanha > 0
        ? `${fin.contas_pagar_amanha} ${plural(fin.contas_pagar_amanha, "conta vence", "contas vencem")} amanhã`
        : "nenhuma conta vence amanhã",
      to: paths.contasPagar,
    },
  ];

  return (
    <Box sx={{ py: { xs: 3, md: 6 }, maxWidth: 1100, mx: "auto" }}>
      <Stack spacing={6}>

        {/* Cabeçalho */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Stack spacing={0.5}>
            <Typography sx={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2 }}>
              {saudacao(user?.nome ?? "Usuário")}
            </Typography>
            <Typography sx={{ fontSize: 15, color: MUTED }}>
              {hojeLabel()}{user?.oficina_nome ? ` · ${user.oficina_nome}` : ""}
            </Typography>
          </Stack>
          <Button variant="contained" disableElevation startIcon={<AddRoundedIcon />} onClick={(e) => setMenuEl(e.currentTarget)}>
            Novo
          </Button>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            {novos.map((n) => (
              <MenuItem key={n.label} onClick={() => { setMenuEl(null); n.onClick(); }}>
                <ListItemIcon>{n.icon}</ListItemIcon>
                {n.label}
              </MenuItem>
            ))}
          </Menu>
        </Stack>

        {erro && <Vazio>Não foi possível carregar o resumo. Atualize a página para tentar de novo.</Vazio>}

        {/* Dinheiro em destaque */}
        {veFinanceiro && !erro && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: { xs: 4, lg: 8 } }}>
            {loading || !fin ? (
              <>
                <Skeleton variant="rounded" height={320} />
                <Skeleton variant="rounded" height={180} />
              </>
            ) : (
              <>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED }}>Faturamento do mês</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 1 }}>
                    <Typography sx={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2 }}>
                      {brl(fin.faturamento_mes)}
                    </Typography>
                    {fin.variacao_percentual !== null && (
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: fin.variacao_percentual >= 0 ? brand.success : brand.error }}>
                        {fin.variacao_percentual >= 0 ? "+" : ""}{fin.variacao_percentual.toLocaleString("pt-BR")}% vs período anterior
                      </Typography>
                    )}
                  </Stack>
                  <GraficoColunas
                    itens={fin.dias.map((d) => ({ rotulo: rotuloDia(d.data), valor: d.total }))}
                    semDados="Nenhuma O.S. concluída nos últimos dias."
                    serie="Faturamento"
                  />
                </Box>

                <Stack spacing={4} justifyContent="center">
                  {financeiroCards?.map((f) => (
                    <Box key={f.label} component="button" onClick={() => navigate(f.to)}
                      sx={{ textAlign: "left", border: 0, background: "none", p: 0, cursor: "pointer", fontFamily: "inherit", "&:hover .seta": { transform: "translateX(3px)", color: brand.primary }, "&:hover .valor": { textDecoration: "underline" } }}>
                      <Stack direction="row" alignItems="center" spacing={0.25}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{f.label}</Typography>
                        <ChevronRightRoundedIcon className="seta" sx={{ fontSize: 18, color: MUTED, transition: "transform 0.15s, color 0.15s" }} />
                      </Stack>
                      <Typography className="valor" sx={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2, textDecorationThickness: "2px", textUnderlineOffset: 4 }}>{brl(f.valor)}</Typography>
                      <Typography sx={{ fontSize: 13, color: MUTED }}>{f.detalhe}</Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Box>
        )}

        {/* Atenção + Agenda */}
        {!erro && (veAtencao || veAgenda) && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: veAgenda && veAtencao ? "1fr 1fr" : "1fr" }, gap: { xs: 5, lg: 8 } }}>
            {veAtencao && (
              <Section title="Precisa de atenção">
                {loading ? (
                  <Skeleton variant="rounded" height={160} />
                ) : resumo?.atencao.length ? (
                  resumo.atencao.map((a) => {
                    const l = linhaAtencao(a);
                    return (
                      <Box key={a.chave} component="button" onClick={() => navigate(l.to)} sx={{ ...rowSx, cursor: "pointer", "&:hover": { background: brand.subtle } }}>
                        <Box sx={{ flex: 1 }}>{l.titulo}</Box>
                        <Box sx={{ fontSize: 13, color: MUTED }}>{l.detalhe}</Box>
                        <ChevronRightRoundedIcon fontSize="small" sx={{ color: MUTED }} />
                      </Box>
                    );
                  })
                ) : (
                  <Vazio>Tudo em dia por aqui.</Vazio>
                )}
              </Section>
            )}

            {veAgenda && (
              <Section title="Agenda de hoje" to={paths.agenda}>
                {loading ? (
                  <Skeleton variant="rounded" height={160} />
                ) : resumo?.agenda?.itens.length ? (
                  <>
                    {resumo.agenda.itens.map((a) => (
                      <Box key={a.id} sx={rowSx}>
                        <Box sx={{ width: 48, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{horaDe(a.inicio)}</Box>
                        <Box sx={{ flex: 1 }}>{a.cliente}</Box>
                        <Box sx={{ fontSize: 13, color: MUTED }}>{[a.veiculo, a.titulo].filter(Boolean).join(" · ")}</Box>
                      </Box>
                    ))}
                    {resumo.agenda.total > resumo.agenda.itens.length && (
                      <Typography sx={{ pt: 1.5, fontSize: 13, color: MUTED }}>
                        e mais {resumo.agenda.total - resumo.agenda.itens.length} hoje
                      </Typography>
                    )}
                  </>
                ) : (
                  <Vazio>Nenhum agendamento para hoje.</Vazio>
                )}
              </Section>
            )}
          </Box>
        )}
      </Stack>

      {/* Dialogs */}
      <DialogCarro
        open={openVeiculo}
        mode="create"
        onClose={() => setOpenVeiculo(false)}
        onSubmit={() => setOpenVeiculo(false)}
      />
      <DialogCliente
        open={openCliente}
        mode="create"
        onClose={() => setOpenCliente(false)}
        onSubmit={() => setOpenCliente(false)}
      />
    </Box>
  );
}
