import * as React from "react";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";
import SecaoConfiguracao, {
  CartaoConfiguracao,
  LinhaConfiguracao,
  SwitchAtivo,
} from "../../configuracoes/components/SecaoConfiguracao";
import { useAdditionalResources } from "../../../context/AdditionalResourcesContext";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { additionalResourceKeys, type AdditionalResourceKey, type AdditionalResourcesMap } from "../api/api";

const recursos: { id: AdditionalResourceKey; label: string; description: string }[] = [
  {
    id: "agenda",
    label: "Agenda",
    description: "Calendário de serviços, vínculo com clientes e veículos e situação de atendimento.",
  },
  {
    id: "estoque",
    label: "Estoque",
    description: "Cadastro de itens, quantidade disponível e preços de custo e venda.",
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro de parceiros e dados de contato, base para contas a pagar.",
  },
];

const todosAtivos = (): AdditionalResourcesMap =>
  Object.fromEntries(additionalResourceKeys.map((key) => [key, true])) as AdditionalResourcesMap;

/** Recursos do sistema: liga e desliga módulos da oficina, no mesmo padrão em cartões das Configurações. */
export default function RecursosAdicionais() {
  const { resources, loading, save } = useAdditionalResources();
  const { can } = useAuth();
  const { success, error } = useToast();
  const [form, setForm] = React.useState<AdditionalResourcesMap>(todosAtivos);
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    setForm(resources);
  }, [resources]);

  const podeEditar = can("recursos_adicionais", "update");
  const ativos = additionalResourceKeys.filter((key) => form[key]).length;
  const alterado = additionalResourceKeys.some((key) => form[key] !== resources[key]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await save(form);
      success("Recursos do sistema salvos.");
    } catch (err) {
      const mensagem = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      error(mensagem ?? "Não foi possível salvar os recursos do sistema.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SecaoConfiguracao
      secao="recursos"
      titulo="Recursos do sistema"
      subtitulo="Escolha quais módulos ficam disponíveis para os usuários desta oficina."
      icone={<WidgetsOutlinedIcon />}
      registro="Recursos do sistema"
      carregando={loading}
      falhou={false}
      onTentarNovamente={() => undefined}
      alterado={alterado}
      salvando={salvando}
      podeEditar={podeEditar}
      onSalvar={salvar}
      onDescartar={() => setForm(resources)}
      esqueleto={[3]}
    >
      <CartaoConfiguracao
        titulo="Módulos"
        descricao={`${ativos} de ${additionalResourceKeys.length} ativos. Os desativados deixam de aparecer no menu lateral.`}
      >
        {recursos.map((item) => (
          <LinhaConfiguracao interruptor key={item.id} titulo={item.label} descricao={item.description}>
            <SwitchAtivo
              textoAntes
              rotulo={`Ativar ${item.label}`}
              checked={form[item.id]}
              onChange={(ativo) => setForm((prev) => ({ ...prev, [item.id]: ativo }))}
              disabled={!podeEditar || salvando}
            />
          </LinhaConfiguracao>
        ))}
      </CartaoConfiguracao>
    </SecaoConfiguracao>
  );
}
