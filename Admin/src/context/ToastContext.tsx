import React, { createContext, useContext, useState, useCallback } from "react";
import { Snackbar, Alert } from "@mui/material";

type Severity = "success" | "error" | "warning" | "info";
type ToastContextType = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
};

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("success");

  const show = useCallback((msg: string, sev: Severity) => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  return (
    <ToastContext.Provider value={{
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      warning: (m) => show(m, "warning"),
    }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={severity}
          onClose={() => setOpen(false)}
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
