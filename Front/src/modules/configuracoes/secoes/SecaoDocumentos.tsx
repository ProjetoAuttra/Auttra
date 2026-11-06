import { TextField } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import {
  buscarConfigDocumentos,
  defaultDocumentosConfig,
  errosDocumentosConfig,
  GARANTIA_MINIMA_DIAS,
  OBSERVACOES_MAX_CARACTERES,
  salvarConfigDocumentos,
} from "../api/configuracoesOperacionais";
import SecaoConfiguracao, { CampoNumero, LinhaConfiguracao } from "../components/SecaoConfiguracao";
import { useSecaoConfig } from "../hooks/useSecaoConfig";

export default function SecaoDocumentos({ podeEditar }: { podeEditar: boolean }) {
  const secao = useSecaoConfig({
    padrao: defaultDocumentosConfig,
    buscar: buscarConfigDocumentos,
    salvar: salvarConfigDocumentos,
    nome: "as configurações de orçamentos e OS",
    temErro: (c) => errosDocumentosConfig(c) !== null,
  });
  const { valor: documentos, setValor } = secao;
  const erros = secao.mostrarErros ? errosDocumentosConfig(documentos) : null;
  const bloqueado = !podeEditar || secao.salvando;

  return (
    <SecaoConfiguracao
      secao="documentos"
      titulo="Orçamentos e OS"
      subtitulo="Prazo de garantia, validade do orçamento e observações que saem nos PDFs."
      icone={<DescriptionOutlinedIcon />}
      registro="Configurações de orçamentos e OS"
      carregando={secao.carregando}
      falhou={secao.falhou}
      onTentarNovamente={secao.tentarNovamente}
      alterado={secao.alterado}
      salvando={secao.salvando}
      podeEditar={podeEditar}
      onSalvar={secao.salvar}
      onDescartar={secao.descartar}
    >
      <LinhaConfiguracao
        titulo="Prazo de garantia"
        descricao={`Garantia dos serviços, impressa no orçamento e na OS. Mínimo de ${GARANTIA_MINIMA_DIAS} dias, que é a garantia legal.`}
      >
        <CampoNumero
          label="Garantia"
          unidade="dias"
          valor={documentos.garantiaDias}
          onChange={(garantiaDias) => setValor((p) => ({ ...p, garantiaDias }))}
          disabled={bloqueado}
          error={!!erros?.garantiaDias}
          helperText={erros?.garantiaDias}
          inputProps={{ min: GARANTIA_MINIMA_DIAS, step: 1, "data-testid": "garantia-dias" }}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Validade padrão do orçamento"
        descricao="Já vem preenchida no novo orçamento e pode ser trocada em cada um."
      >
        <CampoNumero
          label="Validade"
          unidade="dias"
          valor={documentos.validadeOrcamentoDias}
          onChange={(validadeOrcamentoDias) => setValor((p) => ({ ...p, validadeOrcamentoDias }))}
          disabled={bloqueado}
          error={!!erros?.validadeOrcamentoDias}
          helperText={erros?.validadeOrcamentoDias}
          inputProps={{ min: 1, step: 1, "data-testid": "validade-dias" }}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        largo
        titulo="Observações nos documentos"
        descricao="Opcional. Sai junto dos termos no PDF do orçamento e da OS. Ex.: veículos não retirados em 30 dias pagam estadia."
      >
        <TextField
          label="Observações"
          size="small"
          multiline
          minRows={3}
          fullWidth
          value={documentos.observacoes}
          onChange={(e) => setValor((p) => ({ ...p, observacoes: e.target.value }))}
          disabled={bloqueado}
          error={!!erros?.observacoes}
          helperText={erros?.observacoes ?? `${documentos.observacoes.length}/${OBSERVACOES_MAX_CARACTERES} caracteres`}
          inputProps={{ maxLength: OBSERVACOES_MAX_CARACTERES, "data-testid": "observacoes" }}
        />
      </LinhaConfiguracao>
    </SecaoConfiguracao>
  );
}
