import { Box, Stack } from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import {
  buscarConfigNotificacoes,
  defaultNotificationsConfig,
  salvarConfigNotificacoes,
  type NotificationsConfig,
} from "../../notificacoes/api";
import SecaoConfiguracao, { CampoNumero, CartaoConfiguracao, LinhaConfiguracao, SwitchAtivo } from "../components/SecaoConfiguracao";
import { useSecaoConfig } from "../hooks/useSecaoConfig";

type Regra = keyof NotificationsConfig;
type Campo = { chave: string; label: string; unidade: string };
/** Visão genérica de uma regra: `ativo` mais os campos numéricos dela. */
type ValoresRegra = { ativo: boolean } & Record<string, number | boolean>;

const regras: Record<Regra, { titulo: string; descricao: string; campos: Campo[] }> = {
  agenda: {
    titulo: "Agendamentos próximos",
    descricao: "Avisa sobre os agendamentos dos próximos dias.",
    campos: [{ chave: "diasAntecedencia", label: "Antecedência", unidade: "dias" }],
  },
  financeiro: {
    titulo: "Pagamentos vencendo ou vencidos",
    descricao: "Avisa sobre contas perto do vencimento e as que já venceram.",
    campos: [{ chave: "diasVencimento", label: "Antes do vencimento", unidade: "dias" }],
  },
  estoque: {
    titulo: "Estoque baixo",
    descricao: "Avisa quando a quantidade de uma peça chega ao limite.",
    campos: [{ chave: "limiteBaixo", label: "Quantidade mínima", unidade: "un." }],
  },
  ordens: {
    titulo: "Ordens de serviço paradas",
    descricao: "Avisa sobre OS sem andamento e destaca as que estão paradas há mais tempo.",
    campos: [
      { chave: "diasParada", label: "Parada após", unidade: "dias" },
      { chave: "diasCritico", label: "Crítica após", unidade: "dias" },
    ],
  },
  orcamentos: {
    titulo: "Orçamentos pendentes",
    descricao: "Avisa sobre orçamentos esperando resposta do cliente.",
    campos: [{ chave: "diasPendente", label: "Em análise há", unidade: "dias" }],
  },
};

const valoresDa = (c: NotificationsConfig, r: Regra) => c[r] as ValoresRegra;

const ordem: Regra[] = ["agenda", "financeiro", "estoque", "ordens", "orcamentos"];

/** Cartões da tela: as regras agrupadas por assunto. */
const grupos: { titulo: string; regras: Regra[] }[] = [
  { titulo: "Atendimento", regras: ["agenda", "orcamentos", "ordens"] },
  { titulo: "Financeiro e estoque", regras: ["financeiro", "estoque"] },
];

const numeroValido = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** Erro de cada campo numérico ("ordens.diasParada"), ou null se dá para salvar. Espelha o back: inteiros a partir de 0. */
function errosNotificacoes(c: NotificationsConfig) {
  const erros: Record<string, string> = {};
  for (const r of ordem) {
    const valores = valoresDa(c, r);
    // Regra desligada não é validada: o campo fica desabilitado e não teria como ser corrigido.
    if (!valores.ativo) continue;
    for (const campo of regras[r].campos) {
      if (!numeroValido(valores[campo.chave])) erros[`${r}.${campo.chave}`] = "Informe um número inteiro.";
    }
  }
  return Object.keys(erros).length ? erros : null;
}

export default function SecaoNotificacoes({ podeEditar }: { podeEditar: boolean }) {
  const secao = useSecaoConfig({
    padrao: defaultNotificationsConfig,
    buscar: buscarConfigNotificacoes,
    salvar: salvarConfigNotificacoes,
    nome: "as configurações de notificações",
    temErro: (c) => errosNotificacoes(c) !== null,
  });
  const { valor: config, setValor } = secao;
  const erros = secao.mostrarErros ? errosNotificacoes(config) : null;
  const bloqueado = !podeEditar || secao.salvando;

  const setRegra = (regra: Regra, parcial: Partial<ValoresRegra>) =>
    setValor((p) => ({ ...p, [regra]: { ...p[regra], ...parcial } }) as NotificationsConfig);

  return (
    <SecaoConfiguracao
      secao="notificacoes"
      titulo="Notificações"
      subtitulo="Escolha o que o sistema avisa no sino e com quanta antecedência."
      icone={<NotificationsNoneRoundedIcon />}
      registro="Configurações de notificações"
      carregando={secao.carregando}
      falhou={secao.falhou}
      onTentarNovamente={secao.tentarNovamente}
      alterado={secao.alterado}
      salvando={secao.salvando}
      podeEditar={podeEditar}
      onSalvar={secao.salvar}
      onDescartar={secao.descartar}
      esqueleto={[3, 2]}
    >
      {grupos.map((grupo) => (
        <CartaoConfiguracao key={grupo.titulo} titulo={grupo.titulo}>
          {grupo.regras.map((r) => {
            const regra = regras[r];
            const atual = valoresDa(config, r);
            return (
              <LinhaConfiguracao key={r} titulo={regra.titulo} descricao={regra.descricao}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 2 }} alignItems={{ xs: "stretch", sm: "flex-start" }}>
                  <Box sx={{ pt: 0.25, flexShrink: 0 }}>
                    <SwitchAtivo
                      rotulo={`Avisar ${regra.titulo.toLowerCase()}`}
                      checked={atual.ativo}
                      onChange={(ativo) => setRegra(r, { ativo })}
                      disabled={bloqueado}
                    />
                  </Box>
                  <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                    {regra.campos.map((campo) => {
                      const chave = campo.chave;
                      const erro = erros?.[`${r}.${chave}`];
                      return (
                        <CampoNumero
                          key={chave}
                          label={campo.label}
                          unidade={campo.unidade}
                          valor={atual[chave] as number}
                          onChange={(v) => setRegra(r, { [chave]: v })}
                          disabled={bloqueado || !atual.ativo}
                          error={!!erro}
                          helperText={erro}
                          inputProps={{ min: 0, step: 1, "data-testid": `${r}-${chave}` }}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              </LinhaConfiguracao>
            );
          })}
        </CartaoConfiguracao>
      ))}
    </SecaoConfiguracao>
  );
}
