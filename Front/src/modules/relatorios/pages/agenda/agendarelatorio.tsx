import * as React from 'react';
import {
  Box,
  Stack,
  Typography,
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
import FiltrosRelatorio, { type CampoFiltro } from '../../shared/FiltrosRelatorio';
import { inDateRange, periodoMesAtual } from '../../shared/reportUtils';

type Agendamento = {
  id: number;
  cliente: string;
  servico: string;
  data_agendamento: string;
  horario: string;
};

type FiltrosAgenda = { de: string; ate: string; clientes: string[]; servicos: string[] };
const PADRAO: FiltrosAgenda = { ...periodoMesAtual(), clientes: [], servicos: [] };

export default function RelatorioAgenda() {
  const { user } = useAuth();
  const [agenda, setAgenda] = React.useState<Agendamento[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filtros, setFiltros] = React.useState(PADRAO);

  React.useEffect(() => {
    if (!user?.oficina_id) return;

    (async () => {
      try {
        const { data } = await api.get(`/agendamentos`, {
          params: { oficina_id: user.oficina_id },
        });

        const agendamentos: Agendamento[] = data.map((a: any) => {
          const dataAg = a.data_agendamento ?? a.data ?? new Date().toISOString();

          return {
            id: a.id,
            cliente: a.cliente?.nome ?? a.cliente ?? '—',
            servico: a.servico?.nome ?? a.servico ?? '—',
            data_agendamento: dataAg,
            horario:
              a.horario ??
              new Date(dataAg).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
          };
        });

        setAgenda(agendamentos);
      } catch (err) {
        console.error('Erro ao carregar agendamentos:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id]);

  const unicos = (nomes: string[]) =>
    [...new Set(nomes.filter((n) => n && n !== '—'))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((n) => ({ value: n, label: n }));
  const campos: CampoFiltro<FiltrosAgenda>[] = [
    { id: 'clientes', label: 'Cliente', multi: true, opcoes: unicos(agenda.map((a) => a.cliente)) },
    { id: 'servicos', label: 'Serviço', multi: true, opcoes: unicos(agenda.map((a) => a.servico)) },
  ];
  const filtrada = agenda.filter(
    (a) =>
      inDateRange(a.data_agendamento, filtros.de, filtros.ate) &&
      (!filtros.clientes.length || filtros.clientes.includes(a.cliente)) &&
      (!filtros.servicos.length || filtros.servicos.includes(a.servico))
  );

  const handleExportarCSV = () => {
    if (!filtrada.length) return alert('Nenhum agendamento encontrado para exportar.');

    const header = ['Cliente', 'Serviço', 'Data', 'Horário'];
    const rows = filtrada.map((a) => [
      a.cliente,
      a.servico,
      new Date(a.data_agendamento).toLocaleDateString('pt-BR'),
      a.horario,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [header, ...rows].map((r) => r.join(';')).join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `relatorio_agenda_${new Date().toISOString().slice(0, 10)}.csv`
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack>
          <Typography variant="h5" fontWeight={700}>
            Relatório de Agenda
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Agendamentos e horários registrados
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

      <FiltrosRelatorio valores={filtros} onChange={setFiltros} padrao={PADRAO} campos={campos} />

      <Box>
        {filtrada.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Serviço</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Horário</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filtrada.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{a.cliente}</TableCell>
                  <TableCell>{a.servico}</TableCell>
                  <TableCell>
                    {new Date(a.data_agendamento).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{a.horario}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              Nenhum agendamento encontrado.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
