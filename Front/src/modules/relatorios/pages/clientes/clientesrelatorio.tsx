import * as React from 'react';
import {
  Box, Stack, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Button, TextField
} from '@mui/material';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import { buscarTodas } from '../../shared/buscarTodas';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import BarraFiltros from '../../../../components/common/BarraFiltros';
import { inDateRange } from '../../shared/reportUtils';
import EsqueletoPagina from "../../../../components/common/EsqueletoPagina";

type Cliente = {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  created_at?: string;
};

/** Sem período por padrão: o relatório lista todos os clientes; o período filtra pela data de cadastro. */
const PADRAO = { de: '', ate: '', busca: '' };

export default function RelatorioClientes() {
  const { user } = useAuth();
  const { info } = useToast();
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filtros, setFiltros] = React.useState(PADRAO);

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    (async () => {
      try {
        // Todas as páginas: sem paginação a listagem para no teto do servidor.
        setClientes(await buscarTodas<Cliente>('/clientes'));
      } catch (err) {
        console.error('Erro ao carregar clientes:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id]);

  const busca = filtros.busca.trim().toLowerCase();
  const filtrados = clientes.filter(
    (c) =>
      (!filtros.de && !filtros.ate ? true : inDateRange(c.created_at, filtros.de || '0000-01-01', filtros.ate || '9999-12-31')) &&
      (!busca || c.nome.toLowerCase().includes(busca) || (c.email ?? '').toLowerCase().includes(busca) || (c.telefone ?? '').includes(busca))
  );

  const handleExportarCSV = () => {
    if (!filtrados.length) { info('Nenhum cliente encontrado para exportar.'); return; }
    const header = ['Nome', 'Email', 'Telefone', 'Data de Cadastro'];
    const rows = filtrados.map((c) => [
      c.nome,
      c.email,
      c.telefone ?? '',
      c.created_at
        ? new Date(c.created_at).toLocaleDateString('pt-BR')
        : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [header, ...rows].map((r) => r.join(';')).join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `relatorio_clientes_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
  };

  if (loading)
    return <EsqueletoPagina />;

  return (
    <Box sx={{ maxWidth: 1500, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack>
          <Typography variant="h5" fontWeight={700}>Relatório de Clientes</Typography>
          <Typography variant="body2" color="text.secondary">
            Lista completa de clientes cadastrados
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

      <BarraFiltros subtitulo="Refine o relatório" valores={filtros} onChange={setFiltros} padrao={PADRAO}>
        <TextField size="small" label="Buscar cliente" value={filtros.busca} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} sx={{ minWidth: 240 }} />
      </BarraFiltros>

      <Box>
        {filtrados.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell>Data de Cadastro</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{c.nome}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.telefone ?? '—'}</TableCell>
                  <TableCell>
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              Nenhum cliente encontrado.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
