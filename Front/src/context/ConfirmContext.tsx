import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    ReactNode,
} from "react";
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Stack,
    Box,
    Paper,
    IconButton,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// ─── Config por variante ──────────────────────────────────────────────────

const VARIANT_CONFIG = {
    danger: {
        icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 26 }} />,
        iconBg: (t: any) => alpha(t.palette.error.main, 0.1),
        iconColor: "error.main",
        confirmColor: "error" as const,
    },
    warning: {
        icon: <WarningAmberRoundedIcon sx={{ fontSize: 26 }} />,
        iconBg: (t: any) => alpha(t.palette.warning.main, 0.1),
        iconColor: "warning.main",
        confirmColor: "warning" as const,
    },
    info: {
        icon: <HelpOutlineRoundedIcon sx={{ fontSize: 26 }} />,
        iconBg: (t: any) => alpha(t.palette.primary.main, 0.1),
        iconColor: "primary.main",
        confirmColor: "primary" as const,
    },
};

// ─── Context ──────────────────────────────────────────────────────────────

const ConfirmContext = createContext<{ confirm: ConfirmFn }>({
    confirm: async () => false,
});

// ─── Provider ─────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: "",
        variant: "danger",
    });

    // Promessa pendente
    const resolveRef = useRef<(value: boolean) => void>(() => { });

    const confirm: ConfirmFn = useCallback((opts) => {
        setOptions(opts);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        setOpen(false);
        resolveRef.current(true);
    };

    const handleCancel = () => {
        setOpen(false);
        resolveRef.current(false);
    };

    const variant = options.variant ?? "danger";
    const cfg = VARIANT_CONFIG[variant];

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            <Dialog
                open={open}
                onClose={handleCancel}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 1.5,
                        overflow: "hidden",
                        boxShadow: (t) => `0 24px 60px ${alpha(t.palette.common.black, 0.2)}`,
                    },
                }}
            >
                {/* Header */}
                <Paper
                    elevation={0}
                    square
                    sx={{
                        px: 3,
                        pt: 3,
                        pb: 0,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        bgcolor: "background.paper",
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                        {/* Ícone */}
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 1.5,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: cfg.iconBg,
                                color: cfg.iconColor,
                                flexShrink: 0,
                            }}
                        >
                            {cfg.icon}
                        </Box>

                        {/* Título */}
                        <Stack spacing={0.5} pt={0.5}>
                            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
                                {options.title}
                            </Typography>
                            {options.message && (
                                <Typography variant="body2" color="text.secondary" lineHeight={1.5}>
                                    {options.message}
                                </Typography>
                            )}
                        </Stack>
                    </Stack>

                    {/* Fechar */}
                    <IconButton size="small" onClick={handleCancel} sx={{ mt: -0.5, ml: 1 }}>
                        <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                </Paper>

                {/* Ações */}
                <DialogActions
                    sx={{
                        px: 3,
                        py: 2.5,
                        gap: 1,
                        justifyContent: "flex-end",
                    }}
                >
                    <Button
                        onClick={handleCancel}
                        variant="outlined"
                        sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            borderColor: "divider",
                            color: "text.secondary",
                            "&:hover": { borderColor: "text.primary" },
                        }}
                    >
                        {options.cancelLabel ?? "Cancelar"}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        variant="contained"
                        color={cfg.confirmColor}
                        disableElevation
                        sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            px: 2.5,
                        }}
                    >
                        {options.confirmLabel ?? "Confirmar"}
                    </Button>
                </DialogActions>
            </Dialog>
        </ConfirmContext.Provider>
    );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useConfirm() {
    const { confirm } = useContext(ConfirmContext);
    return confirm;
}