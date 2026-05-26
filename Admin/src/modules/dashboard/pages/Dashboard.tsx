import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, Skeleton, Alert, LinearProgress, Button } from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useNavigate } from "react-router-dom";
import api from "../../../api/api";

type Metricas = {
  total_oficinas_ativas: number;
  total_oficinas_inativas: number;
  total_usuarios: number;
  total_os_abertas: number;
  oficinas_no_mes: number;
  oficinas_30_dias: number;
  oficinas_com_os_aberta: number;
  usuarios_ativos_por_oficina: { id: number; nome: string; total_usuarios_ativos: number }[];
  alertas_cadastro: { id: number; nome: string; pendencias: string[] }[];
};

type MetricCardProps = {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  sublabel?: string;
  onClick?: () => void;
};

function MetricCard({ label, value, icon, loading, sublabel, onClick }: MetricCardProps) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 3, flex: "1 1 200px", minWidth: 190,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s",
        "&:hover": onClick ? { boxShadow: 3 } : {},
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </Typography>
        <Box sx={{ color: "text.secondary", opacity: 0.5 }}>{icon}</Box>
      </Box>
      {loading ? (
        <Skeleton variant="text" width={60} height={40} />
      ) : (
        <Typography sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: "text.primary" }}>
          {value ?? 0}
        </Typography>
      )}
      {sublabel && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.75 }}>{sublabel}</Typography>
      )}
    </Paper>
  );
}

export function DashboardPage() {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Metricas>("/metricas")
      .then((r) => setMetricas(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const maxUsuarios = Math.max(...(metricas?.usuarios_ativos_por_oficina.map((o) => o.total_usuarios_ativos) ?? [1]), 1);

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Visão geral das oficinas e pendências administrativas.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <MetricCard
          label="Oficinas ativas"
          value={metricas?.total_oficinas_ativas}
          icon={<BusinessRoundedIcon fontSize="small" />}
          loading={loading}
          onClick={() => navigate("/oficinas")}
        />
        <MetricCard
          label="Oficinas inativas"
          value={metricas?.total_oficinas_inativas}
          icon={<BusinessRoundedIcon fontSize="small" />}
          loading={loading}
          onClick={() => navigate("/oficinas")}
        />
        <MetricCard
          label="Novas este mês"
          value={metricas?.oficinas_no_mes}
          icon={<TrendingUpRoundedIcon fontSize="small" />}
          loading={loading}
          sublabel={`${metricas?.oficinas_30_dias ?? 0} nos últimos 30 dias`}
        />
        <MetricCard
          label="Usuários"
          value={metricas?.total_usuarios}
          icon={<PeopleRoundedIcon fontSize="small" />}
          loading={loading}
          onClick={() => navigate("/usuarios")}
        />
        <MetricCard
          label="OSs em aberto"
          value={metricas?.total_os_abertas}
          icon={<BuildRoundedIcon fontSize="small" />}
          loading={loading}
          sublabel={`${metricas?.oficinas_com_os_aberta ?? 0} oficinas com OS aberta`}
        />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
        <Paper sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 2 }}>Usuários ativos por oficina</Typography>
          {loading ? (
            <Skeleton variant="rectangular" height={180} />
          ) : metricas?.usuarios_ativos_por_oficina.length ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {metricas.usuarios_ativos_por_oficina.map((oficina) => (
                <Box
                  key={oficina.id}
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/oficinas/${oficina.id}`)}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{oficina.nome}</Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{oficina.total_usuarios_ativos}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={(oficina.total_usuarios_ativos / maxUsuarios) * 100} sx={{ height: 6, borderRadius: 1 }} />
                </Box>
              ))}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Nenhuma oficina ativa encontrada.</Typography>
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <WarningAmberRoundedIcon fontSize="small" color="warning" />
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Pendências de cadastro</Typography>
          </Box>
          {loading ? (
            <Skeleton variant="rectangular" height={180} />
          ) : metricas?.alertas_cadastro.length ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {metricas.alertas_cadastro.map((alerta) => (
                <Alert
                  key={alerta.id}
                  severity="warning"
                  action={<Button size="small" onClick={() => navigate(`/oficinas/${alerta.id}`)}>Abrir</Button>}
                >
                  <strong>{alerta.nome}</strong>: {alerta.pendencias.join(", ")}
                </Alert>
              ))}
            </Box>
          ) : (
            <Alert severity="success">Nenhuma pendência crítica de cadastro.</Alert>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
