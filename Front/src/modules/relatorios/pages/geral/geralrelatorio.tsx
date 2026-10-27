import * as React from 'react';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
} from '@mui/material';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import api from '../../../../api/api';
import { useAuth } from '../../../../context/AuthContext';

export default function RelatorioGeral() {
  const { user } = useAuth();
  const [dados, setDados] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.oficina_id) return;

    (async () => {
      try {
        // 🔄 Faz todas as requisições em paralelo
        const [resClientes, resOrdens, resPagamentos] = await Promise.all([
          api.get('/clientes', { params: { oficina_id: user.oficina_id } }),
          api.get('/ordens', { params: { oficina_id: user.oficina_id } }),
          api.get('/pagamentos', { params: { oficina_id: user.oficina_id } }),
        ]);

        // Contagens básicas
        const totalClientes = resClientes.data.length;
        const totalServicos = resOrdens.data.length;

        // Entradas e saídas
        const pagamentos = resPagamentos.data.map((p: any) => ({
          tipo: (p.tipo ?? '').toLowerCase(),
          valor: Number(p.valor ?? p.valor_total ?? 0),
        }));

        const totalEntradas = pagamentos
          .filter((p) => p.tipo === 'entrada' || p.tipo === 'receber')
          .reduce((s, p) => s + p.valor, 0);

        const totalSaidas = pagamentos
          .filter((p) => p.tipo === 'saida' || p.tipo === 'pagar')
          .reduce((s, p) => s + p.valor, 0);

        const consolidado = [
          { categoria: 'Clientes cadastrados', valor: totalClientes },
          { categoria: 'Serviços realizados', valor: totalServicos },
          { categoria: 'Entradas (R$)', valor: totalEntradas },
          { categoria: 'Saídas (R$)', valor: totalSaidas },
        ];

        setDados(consolidado);
      } catch (err) {
        console.error('Erro ao carregar dados gerais:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id]);

  // 📊 Exportar CSV
  const handleExportarCSV = () => {
    if (!dados.length) return alert('Nenhum dado disponível para exportar.');

    const header = ['Categoria', 'Valor'];
    const rows = dados.map((d) => [
      d.categoria,
      d.categoria.includes('R$')
        ? d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : d.valor,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [header, ...rows].map((r) => r.join(';')).join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `relatorio_geral_${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.click();
  };

  if (loading)
    return (
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ maxWidth: 1500, mx: 'auto' }}>
      {/* Cabeçalho */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Stack>
          <Typography variant="h5" fontWeight={700}>
            Relatório Geral
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consolidado de dados e indicadores principais
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<FileDownloadRoundedIcon />}
          sx={{ borderRadius: 2 }}
          onClick={handleExportarCSV}
        >
          Exportar CSV
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 1.5 }}>
        {dados.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Categoria</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.map((d, i) => (
                <TableRow key={i}>
                  <TableCell>{d.categoria}</TableCell>
                  <TableCell align="right">
                    {d.categoria.includes('R$')
                      ? `R$ ${d.valor.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}`
                      : d.valor}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              Nenhum dado encontrado.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
