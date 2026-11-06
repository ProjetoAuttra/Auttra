import { Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import { buscarConfigAgenda, defaultAgendaConfig, salvarConfigAgenda, type AgendaConfig } from "../api/configuracoesOperacionais";
import SecaoConfiguracao, { CampoNumero, LinhaConfiguracao } from "../components/SecaoConfiguracao";
import { useSecaoConfig } from "../hooks/useSecaoConfig";
import {
  DIAS_SEMANA,
  ehHorario,
  escreverDiasAtendimento,
  escreverMinutos,
  lerDiasAtendimento,
  lerMinutos,
} from "../utils/formatosConfig";

function errosAgenda(c: AgendaConfig) {
  const erros: Partial<Record<keyof AgendaConfig, string>> = {};
  if (ehHorario(c.horarioInicio) && ehHorario(c.horarioFim) && c.horarioFim <= c.horarioInicio) {
    erros.horarioFim = "O término precisa ser depois do início.";
  }
  if (!c.horarioInicio.trim()) erros.horarioInicio = "Informe o horário de início.";
  if (!c.horarioFim.trim()) erros.horarioFim = "Informe o horário de término.";
  if (!c.dias.trim()) erros.dias = "Escolha pelo menos um dia.";
  const minutos = lerMinutos(c.tempoMedio);
  if (!c.tempoMedio.trim() || (minutos !== null && minutos < 1)) erros.tempoMedio = "Informe a duração em minutos.";
  return Object.keys(erros).length ? erros : null;
}

export default function SecaoAgenda({ podeEditar }: { podeEditar: boolean }) {
  const secao = useSecaoConfig({
    padrao: defaultAgendaConfig,
    buscar: buscarConfigAgenda,
    salvar: salvarConfigAgenda,
    nome: "as configurações de agenda",
    temErro: (c) => errosAgenda(c) !== null,
  });
  const { valor: agenda, setValor } = secao;
  const set = (parcial: Partial<AgendaConfig>) => setValor((p) => ({ ...p, ...parcial }));
  const erros = secao.mostrarErros ? errosAgenda(agenda) : null;
  const bloqueado = !podeEditar || secao.salvando;

  // Textos antigos fora do formato (ex.: "das 8h ao meio-dia") continuam em campo livre para não se perderem.
  // Vazio conta como "no formato": apagar o campo não pode trocar o controle no meio da edição.
  const vazio = (s: string) => !s.trim();
  const horariosNoFormato = [agenda.horarioInicio, agenda.horarioFim].every((h) => vazio(h) || ehHorario(h));
  const dias = vazio(agenda.dias) ? [] : lerDiasAtendimento(agenda.dias);
  const minutos = vazio(agenda.tempoMedio) ? NaN : lerMinutos(agenda.tempoMedio);

  return (
    <SecaoConfiguracao
      secao="agenda"
      titulo="Agenda"
      subtitulo="Horário de funcionamento e duração padrão dos atendimentos."
      icone={<EventOutlinedIcon />}
      registro="Configurações de agenda"
      carregando={secao.carregando}
      falhou={secao.falhou}
      onTentarNovamente={secao.tentarNovamente}
      alterado={secao.alterado}
      salvando={secao.salvando}
      podeEditar={podeEditar}
      onSalvar={secao.salvar}
      onDescartar={secao.descartar}
    >
      <LinhaConfiguracao titulo="Horário de funcionamento" descricao="Quando a oficina abre e fecha.">
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <TextField
            label="Início"
            size="small"
            fullWidth
            type={horariosNoFormato ? "time" : "text"}
            value={agenda.horarioInicio}
            onChange={(e) => set({ horarioInicio: e.target.value })}
            disabled={bloqueado}
            error={!!erros?.horarioInicio}
            helperText={erros?.horarioInicio}
            InputLabelProps={{ shrink: true }}
          />
          <Typography color="text.secondary" sx={{ pt: 1 }}>
            às
          </Typography>
          <TextField
            label="Término"
            size="small"
            fullWidth
            type={horariosNoFormato ? "time" : "text"}
            value={agenda.horarioFim}
            onChange={(e) => set({ horarioFim: e.target.value })}
            disabled={bloqueado}
            error={!!erros?.horarioFim}
            helperText={erros?.horarioFim}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </LinhaConfiguracao>

      <LinhaConfiguracao titulo="Dias de atendimento" descricao={dias ? agenda.dias || "Nenhum dia escolhido." : "Dias em que a oficina atende."}>
        {dias ? (
          <>
            <ToggleButtonGroup
              color="primary"
              size="small"
              fullWidth
              value={dias}
              onChange={(_, novos: number[]) => set({ dias: escreverDiasAtendimento(novos) })}
              disabled={bloqueado}
              aria-label="Dias de atendimento"
            >
              {DIAS_SEMANA.map((d, i) => (
                <ToggleButton key={d.curto} value={i} aria-label={d.nome} sx={{ px: 0 }}>
                  {d.curto}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {erros?.dias && (
              <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5, mx: 1.75 }}>
                {erros.dias}
              </Typography>
            )}
          </>
        ) : (
          <TextField
            label="Dias de atendimento"
            size="small"
            fullWidth
            value={agenda.dias}
            onChange={(e) => set({ dias: e.target.value })}
            disabled={bloqueado}
            error={!!erros?.dias}
            helperText={erros?.dias}
          />
        )}
      </LinhaConfiguracao>

      <LinhaConfiguracao titulo="Tempo médio por serviço" descricao="Quanto dura, em média, um atendimento na oficina.">
        {minutos !== null ? (
          <CampoNumero
            label="Duração"
            unidade="min"
            valor={minutos}
            onChange={(v) => set({ tempoMedio: Number.isNaN(v) ? "" : escreverMinutos(v) })}
            disabled={bloqueado}
            error={!!erros?.tempoMedio}
            helperText={erros?.tempoMedio}
            inputProps={{ min: 1, step: 5 }}
          />
        ) : (
          <TextField
            label="Duração"
            size="small"
            fullWidth
            value={agenda.tempoMedio}
            onChange={(e) => set({ tempoMedio: e.target.value })}
            disabled={bloqueado}
            error={!!erros?.tempoMedio}
            helperText={erros?.tempoMedio}
          />
        )}
      </LinhaConfiguracao>
    </SecaoConfiguracao>
  );
}
