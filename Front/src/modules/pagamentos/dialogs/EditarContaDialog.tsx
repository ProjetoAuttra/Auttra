import * as React from "react";
import { Button, Stack, TextField } from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import CampoData from "../../../components/common/CampoData";
import { paraInputData, type Conta } from "../api/api";

/** Edita descrição, categoria, observação e vencimento. Mudar o vencimento conta como renegociação de prazo. */
export function EditarContaDialog({ open, conta, onClose, onConfirm }: {
  open: boolean; conta: Conta | null; onClose: () => void;
  onConfirm: (data: any) => void;
}) {
  const [descricao, setDescricao] = React.useState("");
  const [categoria, setCategoria] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [vencimento, setVencimento] = React.useState("");

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

  return (
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} closeOnBackdrop={false} maxWidth="xs" title="Editar conta" icon={<EditRoundedIcon />} variant="entity">
      <AppDialogContent>
        <Stack spacing={2}>
          <TextField label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} size="small" fullWidth />
          <TextField label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} size="small" fullWidth />
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
          <TextField label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} size="small" fullWidth multiline rows={2} />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button variant="contained" disableElevation sx={{ textTransform: "none" }}
          onClick={() => onConfirm({ descricao, categoria, observacao, ...(venceuAlteracao ? { data_vencimento: vencimento } : {}) })}>
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
