import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import routes from "./routes/index.js";
import { publicLinkLimiter } from "./middlewares/rateLimiters.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

// Atras do nginx do Front/Admin (1 hop) o req.ip seria o IP do proxy e todos os usuarios dividiriam
// o mesmo bucket do rate limit. Ajuste TRUST_PROXY ao numero real de proxies na frente da API
// (0 = acesso direto, ex. dev local sem nginx; em deploy com borda extra, como o Railway, tende a ser 2).
const trustProxy = Number(process.env.TRUST_PROXY ?? 1);
app.set("trust proxy", Number.isInteger(trustProxy) && trustProxy >= 0 ? trustProxy : 1);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : false,
    credentials: true,
    methods: "GET,POST,PUT,PATCH,DELETE",
  })
);

app.use(express.json({ limit: "2mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Muitas tentativas de login. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(["/api/auth/login", "/api/auth/verify-email"], loginLimiter);

app.use(["/api/s", "/api/public"], publicLinkLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", routes);
app.use(errorHandler);
