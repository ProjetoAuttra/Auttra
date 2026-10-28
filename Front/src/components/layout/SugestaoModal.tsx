import { useState } from "react";
import { Button, CircularProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import api from "../../api/api";
import { useToast } from "../../context/ToastContext";
import { AppDialog, AppDialogActions, AppDialogContent } from "../common/AppDialog";

// Mesmos valores do backend (enum modulo_sugestao); a ordem segue o menu lateral.
export const MODULOS_SUGESTAO = [
  { value: "inicio", label: "Início" },
  { value: "agenda", label: "Agenda" },
  { value: "clientes", label: "Clientes" },
  { value: "veiculos", label: "Veículos" },
  { value: "orcamentos", label: "Orçamentos" },
  { value: "ordens", label: "Ordens de serviço" },
  { value: "financeiro", label: "Financeiro" },
  { value: "estoque", label: "Estoque" },
  { value: "relatorios", label: "Relatórios" },
  { value: "configuracoes", label: "Configurações" },
  { value: "outros", label: "Outros" },
];

const MIN = 10;
const MAX = 2000;

type Props = { open: boolean; onClose: () => void };

export default function SugestaoModal({ open, onClose }: Props) {
  const { success, error } = useToast();
  const [modulo, setModulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const tamanho = mensagem.trim().length;
  const valido = Boolean(modulo) && tamanho >= MIN && tamanho <= MAX;

  function fechar() {
    setModulo("");
    setMensagem("");
    onClose();
  }

  async function enviar() {
    if (!valido) return;
    setEnviando(true);
    try {
      await api.post("/sugestoes", { modulo, mensagem: mensagem.trim() });
      success("Sugestão enviada. Obrigado por ajudar a melhorar o Auttra!");
      fechar();
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Não foi possível enviar sua sugestão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppDialog
      open={open}
      onClose={fechar}
      onCloseClick={fechar}
      closeOnBackdrop={false}
      maxWidth="sm"
      title="Envie sua sugestão"
      icon={<LightbulbOutlinedIcon />}
    >
      <AppDialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Conte o que podemos melhorar ou o que faria diferença no seu dia a dia. Toda sugestão é lida pelo nosso time.
        </Typography>
        <Stack spacing={2}>
          <TextField
            select
            label="Módulo"
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
            required
            fullWidth
          >
            {MODULOS_SUGESTAO.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Sua sugestão"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value.slice(0, MAX))}
            required
            fullWidth
            multiline
            minRows={5}
            placeholder="Ex.: seria útil poder filtrar as ordens de serviço por mecânico."
            helperText={tamanho > 0 && tamanho < MIN ? `Escreva pelo menos ${MIN} caracteres.` : `${mensagem.length}/${MAX}`}
            error={tamanho > 0 && tamanho < MIN}
          />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={fechar} variant="outlined" disabled={enviando}>Cancelar</Button>
        <Button onClick={enviar} variant="contained" disableElevation disabled={!valido || enviando} sx={{ fontWeight: 700 }}>
          {enviando ? <CircularProgress size={18} color="inherit" /> : "Enviar sugestão"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
