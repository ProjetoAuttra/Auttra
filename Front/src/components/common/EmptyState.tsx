import { Box, Typography, Button, Stack } from "@mui/material";
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
    large?: boolean;
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
    large = false,
}: EmptyStateProps) {
    return (
        <Box sx={{ py: 8, textAlign: "center", ...(large && { minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center" }) }}>
            <Stack alignItems="center" spacing={2}>
                {!isFiltered && illustration && !icon && (
                    <Box sx={{ opacity: 0.9 }}>{illustration}</Box>
                )}
                {(isFiltered || icon || !illustration) && (
                    <Box
                        sx={{
                            width: large ? 88 : 56,
                            height: large ? 88 : 56,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "text.disabled",
                            "& svg": { fontSize: large ? 72 : 44 },
                        }}
                    >
                        {isFiltered ? <SearchOffRoundedIcon sx={{ fontSize: 36 }} /> : icon}
                    </Box>
                )}

                <Stack spacing={0.5} alignItems="center">
                    <Typography variant={large ? "h5" : "subtitle1"} fontWeight={700} color="text.secondary">
                        {isFiltered ? "Nenhum resultado encontrado" : title}
                    </Typography>
                    <Typography variant={large ? "body1" : "body2"} color="text.disabled" sx={{ maxWidth: large ? 440 : 320 }}>
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
                            sx={{ textTransform: "none" }}
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
                        >
                            {actionLabel}
                        </Button>
                    )}
                </Stack>
            </Stack>
        </Box>
    );
}