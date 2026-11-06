import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import { useAssinatura } from "../../../context/AssinaturaContext";
import { useAuth } from "../../../context/AuthContext";
import { brand } from "../../../app/theme";
import {
  DESCONTO_SEMESTRAL, PLANOS, dataBR, formatarPreco, linkAssinar, linkFalarComEquipe, textoDiasRestantes,
  type Assinatura as DadosAssinatura, type PlanoAssinatura,
} from "../assinatura";

const INCLUSO = [
  "Todos os módulos liberados: agenda, clientes, orçamentos, O.S., financeiro, estoque e relatórios",
  "Link para o cliente acompanhar a O.S. e aprovar o orçamento",
  "Tudo o que você cadastrou no teste continua aqui",
];

function subtitulo(a: DadosAssinatura | null) {
  if (!a) return "Escolha o plano da sua oficina.";
  switch (a.situacao) {
    case "teste":
      return `${textoDiasRestantes(a.diasRestantes)} Ele vai até ${dataBR(a.testeTerminaEm)}; assine para continuar usando tudo depois disso.`;
    case "teste_vencido":
      return "Seu teste grátis terminou e a conta está só para consulta. Assine para voltar a criar e editar.";
    case "suspensa":
      return "Sua assinatura está suspensa e a conta está só para consulta. Fale com a gente para reativar.";
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
        p: { xs: 2.5, md: 3 },
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
          <Typography sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
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

/** Planos e situação da assinatura. Na fase manual, assinar abre o WhatsApp do comercial com o plano escolhido. */
export default function Assinatura() {
  const { assinatura } = useAssinatura();
  const { user } = useAuth();
  const oficina = { nome: user?.oficina_nome, id: user?.oficinaId };
  const ativa = assinatura?.situacao === "ativa";
  const suspensa = assinatura?.situacao === "suspensa";

  return (
    <Box sx={{ maxWidth: 920, mx: "auto" }}>
      <ModuleHeader title="Auttra Premium" subtitle={subtitulo(assinatura)} icon={<WorkspacePremiumRoundedIcon />} />

      {ativa || suspensa ? (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack spacing={2} alignItems="flex-start">
            {ativa ? (
              <Alert severity="success" sx={{ width: "100%" }}>Sua assinatura está ativa. Obrigado por usar o Auttra!</Alert>
            ) : (
              <Alert severity="warning" sx={{ width: "100%" }}>Assinatura suspensa: a conta está só para consulta.</Alert>
            )}
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
              {ativa ? "Para trocar de plano ou cancelar, fale com a gente." : "Fale com a gente para regularizar e voltar a criar e editar."}
            </Typography>
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
        </Paper>
      ) : (
        <Stack spacing={3}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <CartaoPlano plano="semestral" destaque link={linkAssinar("semestral", oficina)} />
            <CartaoPlano plano="mensal" link={linkAssinar("mensal", oficina)} />
          </Box>

          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 2 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Um preço por oficina, com tudo liberado</Typography>
            <Stack spacing={1}>
              {INCLUSO.map((item) => (
                <Stack key={item} direction="row" spacing={1.25} alignItems="flex-start">
                  <CheckRoundedIcon sx={{ fontSize: 18, color: brand.success, mt: 0.15 }} />
                  <Typography sx={{ fontSize: 14 }}>{item}</Typography>
                </Stack>
              ))}
            </Stack>
            <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 2 }}>
              O pagamento é combinado pelo WhatsApp e a conta é liberada pela nossa equipe assim que ele é confirmado.
            </Typography>
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
