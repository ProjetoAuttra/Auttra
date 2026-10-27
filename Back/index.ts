import "dotenv/config";
import { app } from "./src/app.js";
import { validateRuntimeEnv } from "./src/config/env.js";
import { fecharNavegadorPdf } from "./src/services/pdfBrowser.js";

const PORT = process.env.PORT || 4000;

validateRuntimeEnv();

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.once(sinal, () => {
    server.close();
    fecharNavegadorPdf().finally(() => process.exit(0));
  });
}
