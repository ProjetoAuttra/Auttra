import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, Skeleton } from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import api from "../../../api/api";

type Metricas = {
  total_oficinas_ativas: number;
  total_usuarios: number;
  total_os_abertas: number;
  oficinas_no_mes: number;
};

type MetricCardProps = {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  sublabel?: string;
};

function MetricCard({ label, value, icon, loading, sublabel }: MetricCardProps) {
  return (
    <Paper sx={{ p: 3, flex: 1, minWidth: 180 }}>
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

  useEffect(() => {
    api.get<Metricas>("/metricas")
      .then((r) => setMetricas(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Visão geral do sistema.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <MetricCard
          label="Oficinas ativas"
          value={metricas?.total_oficinas_ativas}
          icon={<BusinessRoundedIcon fontSize="small" />}
          loading={loading}
        />
        <MetricCard
          label="Novas este mês"
          value={metricas?.oficinas_no_mes}
          icon={<TrendingUpRoundedIcon fontSize="small" />}
          loading={loading}
          sublabel="Oficinas criadas no mês atual"
        />
        <MetricCard
          label="Usuários"
          value={metricas?.total_usuarios}
          icon={<PeopleRoundedIcon fontSize="small" />}
          loading={loading}
        />
        <MetricCard
          label="OSs em aberto"
          value={metricas?.total_os_abertas}
          icon={<BuildRoundedIcon fontSize="small" />}
          loading={loading}
          sublabel="Abertas + em andamento"
        />
      </Box>
    </Box>
  );
}
