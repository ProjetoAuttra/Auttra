import { Box, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
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
}: {
  itens: ItemBarra[];
  semDados: string;
  formato?: (v: number) => string;
}) {
  if (!itens.length) return <SemDados mensagem={semDados} />;
  const altura = Math.max(120, itens.length * 44 + 24);

  return (
    <Box role="img" aria-label={itens.map((i) => `${i.rotulo}: ${formato(i.valor)}`).join("; ")}>
      <BarChart
        layout="horizontal"
        height={altura}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        yAxis={[{ scaleType: "band", data: itens.map((i) => i.rotulo), tickLabelStyle: eixoTexto, disableLine: true, disableTicks: true, width: 110, categoryGapRatio: 0.5 }]}
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
        yAxis={[{ width: 72, tickLabelStyle: eixoTexto, valueFormatter: (v: number) => brl(v), disableLine: true, disableTicks: true }]}
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
