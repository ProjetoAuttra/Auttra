import "dotenv/config";
import { app } from "./src/app.js";
import { validateRuntimeEnv } from "./src/config/env.js";

const PORT = process.env.PORT || 4000;

validateRuntimeEnv();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
