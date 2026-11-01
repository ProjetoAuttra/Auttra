import * as React from "react";
import { Button, CircularProgress, Stack, TextField } from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";
import CampoData from "../../../components/common/CampoData";
import { paraInputData, type Conta } from "../api/api";

/** Edita descrição, categoria, observação e vencimento. Mudar o vencimento conta como renegociação de prazo. */
export function EditarContaDialog({ open, conta, onClose, onConfirm }: {
  open: boolean; conta: Conta | null; onClose: () => void;
  onConfirm: (data: any) => void | Promise<void>;
}) {
  const [descricao, setDescricao] = React.useState("");
  const [categoria, setCategoria] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [vencimento, setVencimento] = React.useState("");
  // Trava o botão enquanto salva: clique duplo não envia a alteração duas vezes.
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    if (open && conta) {
      setDescricao(conta.descricao ?? "");
      setCategoria(conta.categoria ?? "");
      setObservacao(conta.observacao ?? "");
      setVencimento(paraInputData(conta.data_vencimento));
    }
  }, [open, conta]);

  const vencimentoOriginal = conta ? paraInputData(conta.data_vencimento) : "";
  const venceuAlteracao = !!vencimento && vencimento !== vencimentoOriginal;
  const vencimentoTravado = conta?.status === "pago" || conta?.status === "cancelado";

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      await onConfirm({ descricao, categoria, observacao, ...(venceuAlteracao ? { data_vencimento: vencimento } : {}) });
    } catch {
      // Quem chamou já avisou o erro; a gaveta fica aberta com os dados preenchidos.
    } finally {
      setSalvando(false);
    }
  };

  const footer = (
    <>
      <span />
      <Stack direction="row" spacing={1.5}>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button variant="contained" disableElevation sx={{ fontWeight: 700 }}
          disabled={salvando} startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}
          onClick={salvar}>
          Salvar
        </Button>
      </Stack>
    </>
  );

  return (
    <AppDrawer open={open} onClose={onClose} title="Editar conta" subtitle={conta?.descricao} icon={<EditRoundedIcon />} footer={footer}>
      <DrawerSection title="Dados da conta">
        <Stack spacing={2}>
          <TextField label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} size="small" fullWidth />
          <TextField label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} size="small" fullWidth />
        </Stack>
      </DrawerSection>

      <DrawerSection title="Vencimento">
        <CampoData
          label="Data de vencimento"
          value={vencimento}
          onChange={setVencimento}
          disabled={vencimentoTravado}
          helperText={
            vencimentoTravado
              ? "Título já finalizado: o vencimento não pode ser alterado"
              : venceuAlteracao
                ? "Alterar o vencimento conta como renegociação de prazo; a data original é preservada"
                : " "
          }
        />
      </DrawerSection>

      <DrawerSection title="Observações">
        <TextField placeholder="Anotações sobre a conta" inputProps={{ "aria-label": "Observação" }} value={observacao} onChange={(e) => setObservacao(e.target.value)} size="small" fullWidth multiline rows={3} />
      </DrawerSection>
    </AppDrawer>
  );
}
