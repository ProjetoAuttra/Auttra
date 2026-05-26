import React, { createContext, useContext, useState, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from "@mui/material";

type ConfirmOptions = { title: string; message: string; confirmLabel?: string };
type ConfirmContextType = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextType>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "", message: "" });
  const [resolve, setResolve] = useState<(v: boolean) => void>(() => () => {});

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise((res) => setResolve(() => res));
  }, []);

  const close = (value: boolean) => {
    setOpen(false);
    resolve(value);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onClose={() => close(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 600, pb: 1 }}>{opts.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>{opts.message}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => close(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => close(true)}>
            {opts.confirmLabel ?? "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
