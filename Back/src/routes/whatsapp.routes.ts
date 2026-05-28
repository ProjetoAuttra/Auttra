import { Router } from "express";
import { WhatsAppController } from "../controllers/whatsapp.controller.js";

const router = Router();

router.post("/send", WhatsAppController.send);
router.get("/connect", WhatsAppController.getConnectStatus);

export default router;

