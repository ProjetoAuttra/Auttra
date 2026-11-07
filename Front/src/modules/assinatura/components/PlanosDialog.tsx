import { Box, Button, Chip, Dialog, IconButton, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { useAssinatura } from "../../../context/AssinaturaContext";
import { useAuth } from "../../../context/AuthContext";
import { brand } from "../../../app/theme";
import {
  DESCONTO_SEMESTRAL, PLANOS, dataBR, formatarPreco, linkAssinar, linkFalarComEquipe, textoDiasRestantes,
  type Assinatura, type PlanoAssinatura,
} from "../assinatura";

const INCLUSO = [
  "Todos os módulos liberados: agenda, clientes, orçamentos, O.S., financeiro, estoque e relatórios",
  "Link para o cliente acompanhar a O.S. e aprovar o orçamento",
  "Tudo o que você cadastrou no teste continua aqui",
];

function subtitulo(a: Assinatura | null) {
  if (!a) return "Escolha o plano da sua oficina.";
  switch (a.situacao) {
    case "teste":
      return `${textoDiasRestantes(a.diasRestantes)} (até ${dataBR(a.testeTerminaEm)}). Assine para continuar usando tudo depois disso.`;
    case "teste_vencido":
      return "Seu teste grátis terminou e a conta está só para consulta. Assine para voltar a criar e editar.";
    case "suspensa":
      return "Sua assinatura está suspensa e a conta está só para consulta. Escolha um plano para voltar a criar e editar.";
    default:
      return a.plano ? `Plano ${PLANOS[a.plano].nome.toLowerCase()}, ativo desde ${dataBR(a.ativadaEm)}.` : "Assinatura ativa.";
  }
}

function CartaoPlano({ plano, destaque, link }: { plano: PlanoAssinatura; destaque?: boolean; link: string }) {
  const p = PLANOS[plano];
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 2,
        borderColor: destaque ? brand.primary : brand.line,
        borderWidth: destaque ? 2 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Plano {p.nome.toLowerCase()}</Typography>
        {plano === "semestral" && (
          <Chip size="small" label={`${DESCONTO_SEMESTRAL}% mais barato`} sx={{ bgcolor: alpha(brand.success, 0.12), color: brand.success, fontWeight: 700 }} />
        )}
      </Stack>
      <Box>
        <Stack direction="row" alignItems="baseline" spacing={0.75}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: "text.secondary" }}>R$</Typography>
          <Typography sx={{ fontSize: 34, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {formatarPreco(p.precoMensal)}
          </Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>/mês</Typography>
        </Stack>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.75 }}>{p.condicoes}</Typography>
      </Box>
      <Button
        variant={destaque ? "contained" : "outlined"}
        disableElevation
        href={link}
        target="_blank"
        rel="noopener"
        startIcon={<WhatsAppIcon />}
        sx={{ mt: "auto", height: 44, textTransform: "none", fontWeight: 700 }}
      >
        Assinar o {p.nome.toLowerCase()}
      </Button>
    </Paper>
  );
}

/**
 * Compra do Premium num modal no centro da tela, com o fundo desfocado (aberto pela faixa do topo e pelo item do
 * menu). Na fase manual, assinar abre o WhatsApp do comercial com o plano escolhido. Quem já assina vê o contato.
 */
export default function PlanosDialog() {
  const { assinatura, planosAbertos, fecharPlanos } = useAssinatura();
  const { user } = useAuth();
  const oficina = { nome: user?.oficina_nome, id: user?.oficinaId };
  const ativa = assinatura?.situacao === "ativa";

  return (
    <Dialog
      open={planosAbertos}
      onClose={fecharPlanos}
      maxWidth="md"
      fullWidth
      aria-labelledby="titulo-planos"
      slotProps={{
        backdrop: { sx: { backdropFilter: "blur(6px)", bgcolor: alpha(brand.ink, 0.45) } },
        paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 4 }, maxHeight: { xs: "calc(100% - 24px)", sm: "calc(100% - 64px)" } } },
      }}
    >
      <Box sx={{ position: "relative", p: { xs: 2.5, sm: 4 }, overflowY: "auto" }}>
        <IconButton aria-label="Fechar" onClick={fecharPlanos} sx={{ position: "absolute", top: 12, right: 12, color: "text.secondary" }}>
          <CloseRoundedIcon />
        </IconButton>

        <Stack alignItems="center" textAlign="center" spacing={1} sx={{ mb: 3, px: { xs: 3, sm: 6 } }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: brand.primarySoft,
              color: brand.primary,
              "& svg": { fontSize: 26 },
            }}
          >
            <WorkspacePremiumRoundedIcon />
          </Box>
          <Typography id="titulo-planos" component="h2" sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800 }}>
            Auttra Premium
          </Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", maxWidth: 520 }}>{subtitulo(assinatura)}</Typography>
        </Stack>

        {ativa ? (
          <Stack alignItems="center" spacing={2}>
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Para trocar de plano ou cancelar, fale com a gente.</Typography>
            <Button
              variant="contained"
              disableElevation
              startIcon={<WhatsAppIcon />}
              href={linkFalarComEquipe(oficina)}
              target="_blank"
              rel="noopener"
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Falar com a gente
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <CartaoPlano plano="semestral" destaque link={linkAssinar("semestral", oficina)} />
              <CartaoPlano plano="mensal" link={linkAssinar("mensal", oficina)} />
            </Box>

            <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: brand.subtle }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.25 }}>Um preço por oficina, com tudo liberado</Typography>
              <Stack spacing={0.75}>
                {INCLUSO.map((item) => (
                  <Stack key={item} direction="row" spacing={1.25} alignItems="flex-start">
                    <CheckRoundedIcon sx={{ fontSize: 18, color: brand.success, mt: 0.15 }} />
                    <Typography sx={{ fontSize: 13.5 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 1.5 }}>
                O pagamento é combinado pelo WhatsApp e a conta é liberada pela nossa equipe assim que ele é confirmado.
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>
    </Dialog>
  );
}
