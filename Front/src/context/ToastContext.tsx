import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
    Snackbar,
    Alert,
    type AlertColor,
    Typography,
    Stack,
    IconButton,
    Slide,
    type SlideProps,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type ToastSeverity = "success" | "error" | "warning" | "info";

interface ToastOptions {
    message: string;
    severity?: ToastSeverity;
    duration?: number;
    title?: string;
}

interface ToastContextType {
    toast: (options: ToastOptions | string) => void;
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
}

// ─── Animação de entrada ──────────────────────────────────────────────────

function SlideUp(props: SlideProps) {
    return <Slide {...props} direction="up" />;
}

// ─── Ícones por severidade ────────────────────────────────────────────────

const ICONS: Record<ToastSeverity, React.ReactNode> = {
    success: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
    error: <ErrorRoundedIcon sx={{ fontSize: 20 }} />,
    warning: <WarningAmberRoundedIcon sx={{ fontSize: 20 }} />,
    info: <InfoRoundedIcon sx={{ fontSize: 20 }} />,
};

// ─── Context ──────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

// ─── Provider ─────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [title, setTitle] = useState<string | undefined>();
    const [severity, setSeverity] = useState<ToastSeverity>("success");
    const [duration, setDuration] = useState(4000);

    const show = useCallback((opts: ToastOptions | string) => {
        const options: ToastOptions =
            typeof opts === "string" ? { message: opts } : opts;

        setMessage(options.message);
        setTitle(options.title);
        setSeverity(options.severity ?? "success");
        setDuration(options.duration ?? 4000);
        setOpen(true);
    }, []);

    const success = useCallback((msg: string, t?: string) =>
        show({ message: msg, title: t, severity: "success" }), [show]);

    const error = useCallback((msg: string, t?: string) =>
        show({ message: msg, title: t, severity: "error", duration: 6000 }), [show]);

    const warning = useCallback((msg: string, t?: string) =>
        show({ message: msg, title: t, severity: "warning" }), [show]);

    const info = useCallback((msg: string, t?: string) =>
        show({ message: msg, title: t, severity: "info" }), [show]);

    return (
        <ToastContext.Provider value={{ toast: show, success, error, warning, info }}>
            {children}

            <Snackbar
                open={open}
                autoHideDuration={duration}
                onClose={(_, reason) => { if (reason !== "clickaway") setOpen(false); }}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                TransitionComponent={SlideUp}
                sx={{ mb: { xs: 2, sm: 3 }, mr: { xs: 0, sm: 3 } }}
            >
                <Alert
                    severity={severity}
                    variant="filled"
                    icon={false}
                    onClose={() => setOpen(false)}
                    sx={{
                        minWidth: 300,
                        maxWidth: 420,
                        borderRadius: 1.5,
                        py: 1.25,
                        px: 2,
                        boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.18)}`,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 0,
                        "& .MuiAlert-message": { flex: 1, p: 0 },
                        "& .MuiAlert-action": { p: 0, ml: 1, alignSelf: "flex-start" },
                    }}
                >
                    <Stack direction="row" spacing={1.5} alignItems="flex-start" width="100%">
                        {/* Ícone */}
                        <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{ flexShrink: 0, mt: 0.1 }}
                        >
                            {ICONS[severity]}
                        </Stack>

                        {/* Texto */}
                        <Stack spacing={0.15} flex={1} minWidth={0}>
                            {title && (
                                <Typography variant="body2" fontWeight={700} lineHeight={1.3}>
                                    {title}
                                </Typography>
                            )}
                            <Typography variant="body2" fontWeight={title ? 400 : 600} lineHeight={1.4}>
                                {message}
                            </Typography>
                        </Stack>

                        {/* Fechar */}
                        <IconButton
                            size="small"
                            onClick={() => setOpen(false)}
                            sx={{ color: "inherit", opacity: 0.75, mt: -0.25, mr: -0.5, p: 0.25 }}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Stack>
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}