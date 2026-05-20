import { Router } from "express";
import multer from "multer";
import { ImportacaoXmlController } from "../controllers/importacaoXml.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/preview", upload.single("arquivo"), ImportacaoXmlController.preview);
router.post("/confirmar", ImportacaoXmlController.confirmar);

export default router;
