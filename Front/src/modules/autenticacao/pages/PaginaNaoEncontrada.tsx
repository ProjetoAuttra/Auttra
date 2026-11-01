import { Box, Button } from '@mui/material';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../../components/common/EmptyState';
import { paths } from '../../../routes/paths';

/** Rota inexistente dentro do sistema (link quebrado, endereço digitado errado). */
export default function PaginaNaoEncontrada() {
  const nav = useNavigate();
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <EmptyState
        large
        icon={<SearchOffRoundedIcon />}
        title="Página não encontrada"
        description="O endereço pode ter mudado ou não existe mais. Volte ao início para continuar."
      />
      <Box sx={{ textAlign: 'center', mt: -4 }}>
        <Button variant="contained" disableElevation startIcon={<HomeOutlinedIcon />} onClick={() => nav(paths.root)}>
          Ir para o início
        </Button>
      </Box>
    </Box>
  );
}
