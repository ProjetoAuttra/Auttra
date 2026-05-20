import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  TextField,
  InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useToast } from "../../../context/ToastContext";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import { previewXml, confirmarImportacao } from "../api/importacaoXml";
import type { PreviewNota, ItemPreview, ResultadoImportacao } from "../api/importacaoXml";
import { paths } from "../../../routes/paths";
import api from "../../../api/api";

type AcaoItem = "vincular" | "nova_peca" | "ignorar";

interface ItemEditavel extends ItemPreview {
  peca_id_selecionada: number | null;
  preco_venda: number;
}

interface PecaOpcao {
  id: number;
  nome: string;
}

type Etapa = "upload" | "preview" | "sucesso";

export default function ImportarXmlPage() {
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = React.useState<Etapa>("upload");
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewNota | null>(null);
  const [itens, setItens] = React.useState<ItemEditavel[]>([]);
  const [pecas, setPecas] = React.useState<PecaOpcao[]>([]);
  const [resultado, setResultado] = React.useState<ResultadoImportacao | null>(null);

  React.useEffect(() => {
    api.get("/pecas").then((r) => setPecas(r.data)).catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setArquivo(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleGerarPreview = async () => {
    if (!arquivo) return;
    setLoading(true);
    try {
      const dados = await previewXml(arquivo);
      setPreview(dados);
      setItens(
        dados.itens.map((i) => ({
          ...i,
          peca_id_selecionada: i.peca_id,
          preco_venda: i.valor_unitario,
        }))
      );
      setEtapa("preview");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Não conseguimos ler esse XML. Confira se o arquivo é realmente o XML da nota e tente novamente.";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAcaoChange = (idx: number, acao: AcaoItem) => {
    setItens((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, acao, peca_id_selecionada: acao === "vincular" ? it.peca_id : null }
          : it
      )
    );
  };

  const handlePecaChange = (idx: number, pecaId: number) => {
    setItens((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, peca_id_selecionada: pecaId } : it))
    );
  };

  const handlePrecoVendaChange = (idx: number, valor: number) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, preco_venda: valor } : it)));
  };

  const handleConfirmar = async () => {
    if (!preview) return;

    for (const it of itens) {
      if (it.acao === "vincular" && !it.peca_id_selecionada) {
        toastError(`Selecione a peça para vincular: "${it.descricao}"`);
        return;
      }
      if (it.acao === "nova_peca" && (!it.preco_venda || it.preco_venda <= 0)) {
        toastError(`Informe o preço de venda para: "${it.descricao}"`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await confirmarImportacao({
        chave_acesso: preview.chave_acesso,
        numero_nota: preview.numero_nota,
        serie: preview.serie,
        data_emissao: preview.data_emissao,
        fornecedor_id: preview.fornecedor_id,
        fornecedor_nome: preview.fornecedor_nome,
        valor_total: preview.valor_total,
        itens: itens.map((it) => ({
          descricao: it.descricao,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          preco_venda: it.preco_venda,
          acao: it.acao,
          peca_id: it.acao === "vincular" ? it.peca_id_selecionada : null,
        })),
      });
      setResultado(res);
      setEtapa("sucesso");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Não foi possível confirmar a importação.";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const acaoLabel: Record<AcaoItem, string> = {
    vincular: "Vincular peça existente",
    nova_peca: "Criar nova peça",
    ignorar: "Ignorar",
  };

  const acaoCor: Record<AcaoItem, "default" | "primary" | "success" | "error"> = {
    vincular: "primary",
    nova_peca: "success",
    ignorar: "error",
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
      <ModuleHeader
        title="Importar XML da nota"
        subtitle="Envie o XML da nota de compra para atualizar seu estoque com mais rapidez."
        icon={<Inventory2RoundedIcon />}
      />

      {/* ── ETAPA 1: Upload ─────────────────────────────────────── */}
      {etapa === "upload" && (
        <Stack spacing={3}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 2,
              borderStyle: "dashed",
              borderColor: arquivo ? "primary.main" : "divider",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color .2s, background .2s",
              "&:hover": {
                borderColor: "primary.main",
                bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
              },
            }}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              hidden
              onChange={handleFileChange}
            />
            <UploadFileRoundedIcon
              sx={{ fontSize: 52, color: arquivo ? "primary.main" : "text.disabled", mb: 1.5 }}
            />
            {arquivo ? (
              <>
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                  {arquivo.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Clique para trocar o arquivo
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="subtitle1" fontWeight={600}>
                  Clique para selecionar o arquivo XML
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Formato aceito: .xml — tamanho máximo 5 MB
                </Typography>
              </>
            )}
          </Paper>

          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              size="large"
              disabled={!arquivo || loading}
              onClick={handleGerarPreview}
              sx={{ borderRadius: 999, px: 4 }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? "Lendo nota..." : "Ver prévia da nota"}
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ── ETAPA 2: Prévia ─────────────────────────────────────── */}
      {etapa === "preview" && preview && (
        <Stack spacing={3}>
          {preview.ja_importada && (
            <Alert severity="warning">
              Essa nota já foi importada anteriormente. Para evitar duplicidade, o estoque não será
              alterado se você confirmar novamente.
            </Alert>
          )}

          {/* Resumo da nota */}
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              Resumo da nota
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              flexWrap="wrap"
              gap={2}
              divider={<Divider orientation="vertical" flexItem />}
            >
              <InfoNota label="Fornecedor" value={preview.fornecedor_nome || "Não identificado"} />
              <InfoNota label="Número da nota" value={preview.numero_nota || "—"} />
              <InfoNota label="Série" value={preview.serie || "—"} />
              <InfoNota label="Emissão" value={formatarData(preview.data_emissao)} />
              <InfoNota label="Valor total" value={`R$ ${Number(preview.valor_total).toFixed(2)}`} />
              <InfoNota label="Itens encontrados" value={String(preview.itens.length)} />
            </Stack>
          </Paper>

          {/* Tabela de itens */}
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Itens da nota
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Revise cada item e defina o preço de venda antes de confirmar.
              </Typography>
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Descrição</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Qtd</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Custo unit.</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right" width={130}>Venda unit.</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center" width={190}>Ação</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} width={220}>Peça</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {itens.map((it, idx) => (
                  <TableRow key={idx} hover sx={{ verticalAlign: "middle" }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {it.descricao}
                      </Typography>
                      {it.codigo && (
                        <Typography variant="caption" color="text.secondary">
                          Cód: {it.codigo}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {it.quantidade} {it.unidade}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        R$ {Number(it.valor_unitario).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {it.acao === "nova_peca" ? (
                        <TextField
                          size="small"
                          type="number"
                          value={it.preco_venda}
                          onChange={(e) =>
                            handlePrecoVendaChange(idx, parseFloat(e.target.value) || 0)
                          }
                          inputProps={{ min: 0, step: 0.01, style: { textAlign: "right" } }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start" sx={{ mr: 0.25 }}>
                                <Typography variant="caption">R$</Typography>
                              </InputAdornment>
                            ),
                          }}
                          sx={{ width: 110 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <FormControl size="small" fullWidth>
                        <Select
                          value={it.acao}
                          onChange={(e) => handleAcaoChange(idx, e.target.value as AcaoItem)}
                          sx={{ fontSize: 13 }}
                          renderValue={(v) => (
                            <Chip
                              label={acaoLabel[v as AcaoItem]}
                              size="small"
                              color={acaoCor[v as AcaoItem]}
                              sx={{ fontWeight: 600, fontSize: 11 }}
                            />
                          )}
                        >
                          <MenuItem value="vincular">Vincular peça existente</MenuItem>
                          <MenuItem value="nova_peca">Criar nova peça</MenuItem>
                          <MenuItem value="ignorar">Ignorar</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      {it.acao === "vincular" && (
                        <FormControl size="small" fullWidth>
                          <Select
                            value={it.peca_id_selecionada ?? ""}
                            onChange={(e) => handlePecaChange(idx, Number(e.target.value))}
                            displayEmpty
                            sx={{ fontSize: 13 }}
                          >
                            <MenuItem value="" disabled>
                              <em>Selecionar peça...</em>
                            </MenuItem>
                            {pecas.map((p) => (
                              <MenuItem key={p.id} value={p.id}>
                                {p.nome}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      {it.acao === "nova_peca" && (
                        <Typography variant="caption" color="success.main" fontWeight={600}>
                          Será criada como nova peça
                        </Typography>
                      )}
                      {it.acao === "ignorar" && (
                        <Typography variant="caption" color="text.disabled">
                          Item ignorado
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => setEtapa("upload")}
              sx={{ borderRadius: 999 }}
            >
              Voltar
            </Button>
            <Button
              variant="contained"
              size="large"
              disabled={loading || preview.ja_importada}
              onClick={handleConfirmar}
              sx={{ borderRadius: 999, px: 4 }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? "Atualizando estoque..." : "Confirmar entrada no estoque"}
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ── ETAPA 3: Sucesso ────────────────────────────────────── */}
      {etapa === "sucesso" && resultado && (
        <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 72, color: "success.main" }} />
          <Typography variant="h5" fontWeight={800} textAlign="center">
            Estoque atualizado com sucesso!
          </Typography>

          <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, width: "100%", maxWidth: 480 }}>
            <Stack spacing={1.5}>
              <ResumoLinha
                label="Peças com estoque atualizado"
                valor={resultado.itensAtualizados}
                cor="primary.main"
              />
              <ResumoLinha
                label="Novas peças criadas"
                valor={resultado.itensCriados}
                cor="success.main"
              />
              <ResumoLinha
                label="Itens ignorados"
                valor={resultado.itensIgnorados}
                cor="text.secondary"
              />
            </Stack>
          </Paper>

          {resultado.itensIgnorados > 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Os itens ignorados não alteraram o estoque.
            </Typography>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() => {
                setEtapa("upload");
                setArquivo(null);
                setPreview(null);
                setItens([]);
                setResultado(null);
              }}
              sx={{ borderRadius: 999 }}
            >
              Importar outra nota
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(paths.estoque)}
              sx={{ borderRadius: 999 }}
            >
              Ir para o estoque
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

function InfoNota({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25} minWidth={100}>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={600}
        sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Stack>
  );
}

function ResumoLinha({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" fontWeight={700} color={cor}>
        {valor}
      </Typography>
    </Stack>
  );
}

function formatarData(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}
