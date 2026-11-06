import { Box, Checkbox, ListItemText, MenuItem, TextField } from "@mui/material";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { buscarConfigFinanceiro, defaultFinanceiroConfig, salvarConfigFinanceiro, type FinanceiroConfig } from "../api/configuracoesOperacionais";
import SecaoConfiguracao, { CampoNumero, CartaoConfiguracao, LinhaConfiguracao, SwitchAtivo } from "../components/SecaoConfiguracao";
import { useSecaoConfig } from "../hooks/useSecaoConfig";
import { METODO_OPTIONS } from "../../pagamentos/api/api";
import {
  escreverFormasPagamento,
  escreverPercentual,
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

  // Opções = as formas que o sistema registra nos pagamentos. Uma forma salva antes que não está
  // na lista (texto livre antigo) continua aparecendo marcada, para não se perder.
  const mesmoNome = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }) === 0;
  const canonica = (forma: string) => METODO_OPTIONS.find((m) => mesmoNome(m.label, forma))?.label ?? forma;
  const formas = lerFormasPagamento(financeiro.formasPagamento).map(canonica);
  const opcoesFormas = [...METODO_OPTIONS.map((m) => m.label), ...formas.filter((f) => !METODO_OPTIONS.some((m) => m.label === f))];
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
      <CartaoConfiguracao titulo="Pagamentos" descricao="Como a oficina recebe e o que cobra quando atrasa.">
      <LinhaConfiguracao titulo="Formas de pagamento" descricao="Saem no PDF do orçamento e da OS.">
        <TextField
          select
          size="small"
          fullWidth
          label="Formas de pagamento"
          value={formas}
          onChange={(e) => {
            const marcadas = e.target.value as unknown as string[];
            // Mantém a ordem da lista, não a ordem dos cliques.
            set({ formasPagamento: escreverFormasPagamento(opcoesFormas.filter((o) => marcadas.includes(o))) });
          }}
          disabled={bloqueado}
          error={!!erros?.formasPagamento}
          helperText={erros?.formasPagamento}
          InputLabelProps={{ shrink: true }}
          SelectProps={{
            multiple: true,
            displayEmpty: true,
            renderValue: (v) =>
              (v as string[]).length ? (
                (v as string[]).join(", ")
              ) : (
                <Box component="span" sx={{ color: "text.disabled" }}>
                  Nenhuma forma de pagamento selecionada
                </Box>
              ),
          }}
        >
          {opcoesFormas.map((forma) => (
            <MenuItem key={forma} value={forma} dense>
              <Checkbox size="small" checked={formas.includes(forma)} />
              <ListItemText primary={forma} />
            </MenuItem>
          ))}
        </TextField>
      </LinhaConfiguracao>

      <LinhaConfiguracao titulo="Juros por atraso" descricao="Cobrado sobre valores pagos depois do vencimento.">
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
      </CartaoConfiguracao>

      <CartaoConfiguracao titulo="Recibos">
      <LinhaConfiguracao interruptor titulo="Emissão automática" descricao="Gera o recibo quando uma conta a receber é marcada como paga.">
        <SwitchAtivo
          textoAntes
          rotulo="Emissão automática de recibos"
          checked={financeiro.emitirRecibos}
          onChange={(emitirRecibos) => set({ emitirRecibos })}
          disabled={bloqueado}
        />
      </LinhaConfiguracao>
      </CartaoConfiguracao>
    </SecaoConfiguracao>
  );
}
