import { Autocomplete, TextField } from "@mui/material";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { buscarConfigFinanceiro, defaultFinanceiroConfig, salvarConfigFinanceiro, type FinanceiroConfig } from "../api/configuracoesOperacionais";
import SecaoConfiguracao, { CampoNumero, LinhaConfiguracao, SwitchAtivo } from "../components/SecaoConfiguracao";
import { useSecaoConfig } from "../hooks/useSecaoConfig";
import {
  escreverFormasPagamento,
  escreverPercentual,
  FORMAS_PAGAMENTO_SUGERIDAS,
  lerFormasPagamento,
  lerPercentual,
} from "../utils/formatosConfig";

function errosFinanceiro(c: FinanceiroConfig) {
  const erros: Partial<Record<keyof FinanceiroConfig, string>> = {};
  if (lerFormasPagamento(c.formasPagamento).length === 0) erros.formasPagamento = "Escolha pelo menos uma forma de pagamento.";
  const juros = lerPercentual(c.jurosAtraso);
  if (!c.jurosAtraso.trim() || (juros !== null && juros > 100)) erros.jurosAtraso = "Informe um percentual de 0 a 100.";
  return Object.keys(erros).length ? erros : null;
}

export default function SecaoFinanceiro({ podeEditar }: { podeEditar: boolean }) {
  const secao = useSecaoConfig({
    padrao: defaultFinanceiroConfig,
    buscar: buscarConfigFinanceiro,
    salvar: salvarConfigFinanceiro,
    nome: "as configurações financeiras",
    temErro: (c) => errosFinanceiro(c) !== null,
  });
  const { valor: financeiro, setValor } = secao;
  const set = (parcial: Partial<FinanceiroConfig>) => setValor((p) => ({ ...p, ...parcial }));
  const erros = secao.mostrarErros ? errosFinanceiro(financeiro) : null;
  const bloqueado = !podeEditar || secao.salvando;

  const formas = lerFormasPagamento(financeiro.formasPagamento);
  // Vazio conta como "no formato": apagar o campo não pode trocar o controle no meio da edição.
  const juros = financeiro.jurosAtraso.trim() ? lerPercentual(financeiro.jurosAtraso) : NaN;

  return (
    <SecaoConfiguracao
      secao="financeiro"
      titulo="Financeiro"
      subtitulo="Formas de pagamento, juros e emissão de recibos."
      icone={<PaymentsOutlinedIcon />}
      registro="Configurações financeiras"
      carregando={secao.carregando}
      falhou={secao.falhou}
      onTentarNovamente={secao.tentarNovamente}
      alterado={secao.alterado}
      salvando={secao.salvando}
      podeEditar={podeEditar}
      onSalvar={secao.salvar}
      onDescartar={secao.descartar}
    >
      <LinhaConfiguracao titulo="Formas de pagamento" descricao="Aceitas pela oficina. Saem no PDF do orçamento e da OS.">
        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={FORMAS_PAGAMENTO_SUGERIDAS}
          value={formas}
          onChange={(_, novas) => set({ formasPagamento: escreverFormasPagamento(novas) })}
          disabled={bloqueado}
          filterSelectedOptions
          renderInput={(params) => (
            <TextField
              {...params}
              label="Formas de pagamento"
              placeholder={formas.length ? undefined : "Escolha ou digite"}
              error={!!erros?.formasPagamento}
              helperText={erros?.formasPagamento}
            />
          )}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao titulo="Juros por atraso" descricao="Percentual cobrado sobre valores pagos depois do vencimento.">
        {juros !== null ? (
          <CampoNumero
            label="Juros"
            unidade="%"
            valor={juros}
            onChange={(v) => set({ jurosAtraso: Number.isNaN(v) ? "" : escreverPercentual(v) })}
            disabled={bloqueado}
            error={!!erros?.jurosAtraso}
            helperText={erros?.jurosAtraso}
            inputProps={{ min: 0, max: 100, step: 0.5 }}
          />
        ) : (
          <TextField
            label="Juros"
            size="small"
            fullWidth
            value={financeiro.jurosAtraso}
            onChange={(e) => set({ jurosAtraso: e.target.value })}
            disabled={bloqueado}
            error={!!erros?.jurosAtraso}
            helperText={erros?.jurosAtraso}
          />
        )}
      </LinhaConfiguracao>

      <LinhaConfiguracao titulo="Emissão automática de recibos" descricao="Gera o recibo quando uma conta a receber é marcada como paga.">
        <SwitchAtivo
          rotulo="Emissão automática de recibos"
          checked={financeiro.emitirRecibos}
          onChange={(emitirRecibos) => set({ emitirRecibos })}
          disabled={bloqueado}
        />
      </LinhaConfiguracao>
    </SecaoConfiguracao>
  );
}
