import * as React from 'react';
import {
  Box, Stack, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, Button, CircularProgress
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import api from '../../../../api/api';
import { useAuth } from '../../../../context/AuthContext';

type Cliente = {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  created_at?: string;
};

export default function RelatorioClientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    (async () => {
      try {
        const { data } = await api.get(`/clientes`, {
          params: { oficina_id: user.oficina_id },
        });
        setClientes(data);
      } catch (err) {
        console.error('Erro ao carregar clientes:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id]);

  const handleExportarCSV = () => {
    if (!clientes.length) return alert('Nenhum cliente encontrado para exportar.');
    const header = ['Nome', 'Email', 'Telefone', 'Data de Cadastro'];
    const rows = clientes.map((c) => [
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
    return (
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: 4, py: 3 }}>
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
          sx={{ borderRadius: 1.5 }}
          onClick={handleExportarCSV}
        >
          Exportar CSV
        </Button>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          borderRadius: 1,
        }}
      >
        {clientes.length ? (
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
              {clientes.map((c) => (
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
      </Paper>
    </Box>
  );
}
