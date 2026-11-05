import * as React from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import api from "../../api/api";
import { brand } from "../../app/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  orcamento: { id: number; valor: number | string; cliente?: { nome: string; telefone?: string | null } | null };
};

/** Endereço que o cliente abre: a página pública de acompanhamento deste front. */
const linkPublico = (code: string) => `${window.location.origin}/acompanhamento/${code}`;

/** Mensagem do WhatsApp com o link para o cliente ver, aprovar ou recusar. */
function mensagemLink(orcamento: Props["orcamento"], link: string) {
  const valor = Number(orcamento.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const saudacao = orcamento.cliente?.nome ? `Olá ${orcamento.cliente.nome.split(" ")[0]}!` : "Olá!";
  return `${saudacao} Segue o orçamento #${orcamento.id} no valor de ${valor}. Você pode ver os detalhes e aprovar ou recusar por aqui: ${link}`;
}

async function copiarTexto(texto: string, campo: HTMLInputElement | null) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Fora de HTTPS (ex.: acesso pelo IP da rede) a Clipboard API não existe: copia pela seleção do campo.
    if (!campo) return false;
    campo.select();
    return document.execCommand?.("copy") ?? false;
  }
}

/**
 * Gera (ou reaproveita) o link público do orçamento e oferece copiar, mandar por WhatsApp ou abrir.
 * O link é o mesmo enquanto não for cancelado: mandar de novo não invalida o que o cliente já recebeu.
 */
export default function LinkClienteDialog({ open, onClose, orcamento }: Props) {
  const [link, setLink] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState("");
  const [copiado, setCopiado] = React.useState(false);
  const campo = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let ativo = true;
    setLink(null);
    setErro("");
    setCopiado(false);
    api
      .post<{ code: string }>(`/orcamentos/${orcamento.id}/share`)
      .then(({ data }) => { if (ativo) setLink(linkPublico(data.code)); })
      .catch(() => { if (ativo) setErro("Não foi possível gerar o link. Tente novamente."); });
    return () => { ativo = false; };
  }, [open, orcamento.id]);

  const copiar = async () => {
    if (!link) return;
    setCopiado(await copiarTexto(link, campo.current));
  };

  const telefone = (orcamento.cliente?.telefone ?? "").replace(/\D/g, "");
  const whatsappUrl = link
    ? `https://wa.me/${telefone ? `55${telefone}` : ""}?text=${encodeURIComponent(mensagemLink(orcamento, link))}`
    : undefined;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link para o cliente</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Pelo link o cliente vê o orçamento, baixa o PDF e pode aprovar ou recusar. Você é avisado nas notificações.
          </Typography>
          {erro ? (
            <Alert severity="error">{erro}</Alert>
          ) : !link ? (
            <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={28} /></Stack>
          ) : (
            <TextField
              value={link}
              inputRef={campo}
              fullWidth
              size="small"
              label="Link do orçamento"
              onFocus={(e) => e.target.select()}
              inputProps={{ readOnly: true, "data-testid": "link-cliente" }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button size="small" onClick={copiar} startIcon={<ContentCopyRoundedIcon fontSize="small" />}>
                      {copiado ? "Copiado!" : "Copiar"}
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
          )}
          {link && !telefone && (
            <Alert severity="info">
              O cliente não tem telefone cadastrado: o WhatsApp abre para você escolher o contato.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose}>Fechar</Button>
        <Button href={link ?? ""} target="_blank" rel="noreferrer" disabled={!link} startIcon={<OpenInNewRoundedIcon />}>
          Abrir
        </Button>
        <Button
          href={whatsappUrl ?? ""}
          target="_blank"
          rel="noreferrer"
          disabled={!link}
          variant="contained"
          disableElevation
          startIcon={<WhatsAppIcon />}
          sx={{ bgcolor: brand.whatsapp, "&:hover": { bgcolor: brand.whatsappHover }, fontWeight: 700 }}
        >
          Enviar por WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
