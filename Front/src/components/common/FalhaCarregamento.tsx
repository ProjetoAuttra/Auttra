import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

/** Motivo da falha ao carregar um registro: não existe (404) ou erro de rede/servidor. */
export type MotivoFalha = "nao_encontrado" | "erro";

/** Classifica o erro do axios: 404 é "não encontrado", o resto é falha de carregamento. */
export const motivoDaFalha = (err: unknown): MotivoFalha =>
  (err as { response?: { status?: number } })?.response?.status === 404 ? "nao_encontrado" : "erro";

type Props = {
  motivo: MotivoFalha;
  /** Ex.: "Cliente", "Veículo" — vira "Cliente não encontrado." */
  registro: string;
  onTentarNovamente?: () => void;
  onVoltar: () => void;
  /** Concorda o texto com registros femininos: "Ordem de serviço não encontrada." */
  feminino?: boolean;
};

/** Bloco no lugar da tela de detalhes quando o registro não carrega, em vez de deixar a página em branco. */
export default function FalhaCarregamento({ motivo, registro, onTentarNovamente, onVoltar, feminino = false }: Props) {
  const naoEncontrado = motivo === "nao_encontrado";
  const a = feminino ? "a" : "o";
  return (
    <Box sx={{ py: 8, px: 2, textAlign: "center" }} role="alert">
      <Typography variant="h6" fontWeight={700}>
        {naoEncontrado ? `${registro} não encontrad${a}.` : `Não foi possível carregar: ${registro.toLowerCase()}.`}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420, mx: "auto" }}>
        {naoEncontrado
          ? `${feminino ? "Ela" : "Ele"} pode ter sido excluíd${a} ou pertencer a outra oficina.`
          : "Verifique sua conexão e tente de novo. Se continuar, fale com o suporte."}
      </Typography>
      <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={onVoltar}>
          Voltar
        </Button>
        {!naoEncontrado && onTentarNovamente && (
          <Button variant="contained" disableElevation startIcon={<RefreshRoundedIcon />} onClick={onTentarNovamente}>
            Tentar novamente
          </Button>
        )}
      </Stack>
    </Box>
  );
}
