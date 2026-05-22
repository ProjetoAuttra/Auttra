import { Box, Typography, Button, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";

interface EmptyStateProps {
    illustration?: React.ReactNode;
    icon?: React.ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    isFiltered?: boolean;
    onClearFilter?: () => void;
}

export default function EmptyState({
    illustration,
    icon,
    title,
    description,
    actionLabel,
    onAction,
    isFiltered = false,
    onClearFilter,
}: EmptyStateProps) {
    return (
        <Box sx={{ py: 8, textAlign: "center" }}>
            <Stack alignItems="center" spacing={2}>
                {!isFiltered && illustration && (
                    <Box sx={{ opacity: 0.9 }}>{illustration}</Box>
                )}
                <Box
                    sx={{
                        width: 72,
                        height: 72,
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
                        color: "text.disabled",
                        "& svg": { fontSize: 36 },
                    }}
                >
                    {isFiltered ? <SearchOffRoundedIcon sx={{ fontSize: 36 }} /> : icon}
                </Box>

                <Stack spacing={0.5} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                        {isFiltered ? "Nenhum resultado encontrado" : title}
                    </Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 320 }}>
                        {isFiltered
                            ? "Tente ajustar os filtros ou a busca para encontrar o que procura."
                            : (description ?? "Ainda não há nenhum registro aqui.")}
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1.5}>
                    {isFiltered && onClearFilter && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={onClearFilter}
                            sx={{ textTransform: "none", borderRadius: 999 }}
                        >
                            Limpar filtros
                        </Button>
                    )}
                    {actionLabel && onAction && (
                        <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            startIcon={<AddRoundedIcon />}
                            onClick={onAction}
                            sx={{
                                textTransform: "none",
                                borderRadius: 999,
                                fontWeight: 700,
                                background: (t) =>
                                    `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
                            }}
                        >
                            {actionLabel}
                        </Button>
                    )}
                </Stack>
            </Stack>
        </Box>
    );
}