import { Box, Button } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmptyState from '../../../components/common/EmptyState';
import { useAuth } from '../../../context/AuthContext';
import { paths } from '../../../routes/paths';
import { useNavigate } from 'react-router-dom';

/** Usuário logado cujo perfil não libera nenhuma tela do sistema. */
export default function SemAcesso() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <EmptyState
        large
        icon={<LockOutlinedIcon />}
        title="Sem acesso"
        description="Seu perfil de acesso não libera nenhuma tela do sistema. Peça ao responsável pela oficina para revisar suas permissões."
      />
      <Box sx={{ textAlign: 'center', mt: -4 }}>
        <Button variant="outlined" onClick={() => { signOut(); nav(paths.login, { replace: true }); }}>
          Sair
        </Button>
      </Box>
    </Box>
  );
}
