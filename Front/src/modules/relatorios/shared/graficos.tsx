import { Box, Stack, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { brl } from "./reportUtils";

/**
 * Cores dos gráficos (paleta categórica de referência, validada para daltonismo nas duas primeiras posições):
 * azul para entradas/uma série única e laranja para saídas. A cor identifica a série, nunca decora.
 */
export const COR_SERIE_1 = "#2a78d6";
export const COR_SERIE_2 = "#eb6834";

const eixoTexto = { fontSize: 12 };

function SemDados({ mensagem }: { mensagem: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
      {mensagem}
    </Typography>
  );
}

export type ItemBarra = { rotulo: string; valor: number };

/** Barras horizontais de uma série (magnitude por categoria), já ordenadas do maior para o menor. */
export function GraficoBarrasHorizontais({
  itens,
  semDados,
  formato = brl,
  larguraRotulo = 130,
  ordenar = true,
}: {
  itens: ItemBarra[];
  semDados: string;
  formato?: (v: number) => string;
  /** Largura reservada para os rótulos das categorias, à esquerda. */
  larguraRotulo?: number;
  /** Ordena do maior para o menor; desligue quando a ordem da categoria importa (ex.: faixas de atraso). */
  ordenar?: boolean;
}) {
  if (!itens.length || itens.every((i) => i.valor <= 0)) return <SemDados mensagem={semDados} />;
  if (ordenar) itens = [...itens].sort((a, b) => b.valor - a.valor);
  const altura = Math.max(120, itens.length * 44 + 24);

  return (
    <Box role="img" aria-label={itens.map((i) => `${i.rotulo}: ${formato(i.valor)}`).join("; ")}>
      <BarChart
        layout="horizontal"
        height={altura}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        yAxis={[{ scaleType: "band", data: itens.map((i) => i.rotulo), tickLabelStyle: eixoTexto, disableLine: true, disableTicks: true, width: larguraRotulo, categoryGapRatio: 0.5 }]}
        // O eixo vai além do maior valor para sobrar espaço, dentro da área do gráfico, para o rótulo da ponta da barra.
        xAxis={[{ min: 0, max: Math.max(...itens.map((i) => i.valor)) * 1.45, hideTooltip: true, disableLine: true, disableTicks: true, tickLabelStyle: { display: "none" } }]}
        series={[
          {
            data: itens.map((i) => i.valor),
            color: COR_SERIE_1,
            valueFormatter: (v) => (v == null ? "" : formato(v)),
            // O valor fica escrito na ponta de cada barra (rótulo direto), em texto padrão.
            barLabel: (item) => (item.value == null ? "" : formato(item.value)),
            barLabelPlacement: "outside",
          },
        ]}
        borderRadius={4}
        hideLegend
        grid={{ vertical: false, horizontal: false }}
        slotProps={{ barLabel: { style: { fontSize: 12, fontWeight: 600 } } }}
      />
    </Box>
  );
}

export type SemanaBarra = { rotulo: string; entradas: number; saidas: number };

/** Colunas agrupadas por semana: entradas (azul) e saídas (laranja), com legenda e dica ao passar o mouse. */
export function GraficoEntradasSaidas({ semanas, semDados }: { semanas: SemanaBarra[]; semDados: string }) {
  const temValor = semanas.some((s) => s.entradas > 0 || s.saidas > 0);
  if (!temValor) return <SemDados mensagem={semDados} />;

  return (
    <Box
      role="img"
      aria-label={semanas.map((s) => `Semana de ${s.rotulo}: entradas ${brl(s.entradas)}, saídas ${brl(s.saidas)}`).join("; ")}
    >
      <BarChart
        height={260}
        margin={{ top: 40, right: 8, bottom: 8, left: 8 }}
        xAxis={[{ scaleType: "band", data: semanas.map((s) => s.rotulo), tickLabelStyle: eixoTexto, disableTicks: true, categoryGapRatio: 0.45, barGapRatio: 0.15 }]}
        yAxis={[{ width: 92, tickLabelStyle: eixoTexto, valueFormatter: (v: number) => brl(v), disableLine: true, disableTicks: true }]}
        series={[
          { data: semanas.map((s) => s.entradas), label: "Entradas (recebido)", color: COR_SERIE_1, valueFormatter: (v) => (v == null ? "" : brl(v)) },
          { data: semanas.map((s) => s.saidas), label: "Saídas (pago)", color: COR_SERIE_2, valueFormatter: (v) => (v == null ? "" : brl(v)) },
        ]}
        borderRadius={4}
        grid={{ horizontal: true }}
        slotProps={{ legend: { position: { vertical: "top", horizontal: "start" } } }}
      />
    </Box>
  );
}

/** Semanas (começando na segunda) que cobrem o período, para mostrar também as semanas sem movimento. */
export function semanasDoPeriodo(inicioISO: string, fimISO: string): Date[] {
  const inicio = new Date(`${inicioISO}T00:00:00`);
  const fim = new Date(`${fimISO}T00:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) return [];
  const semanas: Date[] = [];
  const cursor = new Date(inicio);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)); // volta para a segunda-feira
  while (cursor <= fim && semanas.length < 60) {
    semanas.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return semanas;
}

export const chaveSemana = (d: Date) => {
  const seg = new Date(d);
  seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  return `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, "0")}-${String(seg.getDate()).padStart(2, "0")}`;
};

export const rotuloSemana = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;


/** Ordem fixa de cores por categoria (paleta categórica de referência): a cor segue a categoria, não o ranking. */
const CORES_CATEGORIAS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

/**
 * Pizza de partes de um todo (poucas categorias). Cada fatia tem uma folga de 2px entre si, e a legenda ao lado
 * escreve categoria, valor e percentual em texto padrão, para a identidade não depender só da cor.
 * `ordemCores` fixa a cor de cada categoria pelo nome, mesmo que o ranking mude.
 */
export function GraficoPizza({
  itens,
  ordemCores,
  semDados,
}: {
  itens: ItemBarra[];
  ordemCores: string[];
  semDados: string;
}) {
  if (!itens.length) return <SemDados mensagem={semDados} />;
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const cor = (rotulo: string) => CORES_CATEGORIAS[Math.max(0, ordemCores.indexOf(rotulo)) % CORES_CATEGORIAS.length];

  return (
    <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" spacing={3} sx={{ py: 1 }}>
      <Box
        role="img"
        aria-label={itens.map((i) => `${i.rotulo}: ${brl(i.valor)} (${Math.round((i.valor / total) * 100)}%)`).join("; ")}
        sx={{ flexShrink: 0 }}
      >
        <PieChart
          width={200}
          height={200}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
          hideLegend
          series={[
            {
              data: itens.map((i) => ({ id: i.rotulo, label: i.rotulo, value: i.valor, color: cor(i.rotulo) })),
              paddingAngle: 1,
              cornerRadius: 3,
              innerRadius: 0,
              outerRadius: 96,
              valueFormatter: (v) => `${brl(v.value)} (${Math.round((v.value / total) * 100)}%)`,
            },
          ]}
        />
      </Box>

      <Stack spacing={1} sx={{ minWidth: 0, flex: 1, width: "100%" }}>
        {itens.map((i) => (
          <Stack key={i.rotulo} direction="row" alignItems="center" spacing={1.25}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: cor(i.rotulo), flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>{i.rotulo}</Typography>
            <Typography variant="body2" fontWeight={600}>{brl(i.valor)}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ width: 40, textAlign: "right" }}>
              {Math.round((i.valor / total) * 100)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}


export type ColunaSimples = { rotulo: string; valor: number };

/** Colunas de uma série (ex.: faturamento por semana). Série única: sem legenda, o título da seção já nomeia. */
export function GraficoColunas({ itens, semDados, serie = "Valor" }: { itens: ColunaSimples[]; semDados: string; serie?: string }) {
  if (!itens.some((i) => i.valor > 0)) return <SemDados mensagem={semDados} />;
  return (
    <Box role="img" aria-label={itens.map((i) => `${i.rotulo}: ${brl(i.valor)}`).join("; ")}>
      <BarChart
        height={260}
        margin={{ top: 16, right: 8, bottom: 8, left: 8 }}
        xAxis={[{ scaleType: "band", data: itens.map((i) => i.rotulo), tickLabelStyle: eixoTexto, disableTicks: true, categoryGapRatio: 0.5 }]}
        yAxis={[{ width: 92, tickLabelStyle: eixoTexto, valueFormatter: (v: number) => brl(v), disableLine: true, disableTicks: true }]}
        series={[{ data: itens.map((i) => i.valor), label: serie, color: COR_SERIE_1, valueFormatter: (v) => (v == null ? "" : brl(v)) }]}
        borderRadius={4}
        hideLegend
        grid={{ horizontal: true }}
      />
    </Box>
  );
}
