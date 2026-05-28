type SendMessageInput = {
  phone: string;
  message: string;
  oficinaId: number;
};

export class WhatsAppDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = "WhatsAppDeliveryError";
  }
}

export const WhatsAppService = {
  async send({ phone, message, oficinaId }: SendMessageInput) {
    const apiUrl = process.env.EVOLUTION_API_URL?.trim();
    const apiKey = process.env.EVOLUTION_API_TOKEN?.trim();
    const baseInstance = process.env.EVOLUTION_API_INSTANCE?.trim() || "driveon";
    const instanceName = `${baseInstance}_${oficinaId}`;

    if (!apiUrl || !apiKey) {
      throw new WhatsAppDeliveryError("Serviço de WhatsApp não configurado no servidor (EVOLUTION_API_URL ou EVOLUTION_API_TOKEN ausentes).");
    }

    if (!phone) {
      throw new Error("Telefone do destinatário é obrigatório.");
    }

    // Clean phone number
    let cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
      cleanedPhone = "55" + cleanedPhone;
    }

    // Handle trailing slash on URL
    const baseUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
    const sendUrl = `${baseUrl}/message/sendText/${instanceName}`;

    console.log(`[WhatsAppService] Enviando mensagem para ${cleanedPhone} via ${sendUrl}`);

    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: cleanedPhone,
        text: message,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(`[WhatsAppService] Erro ao enviar. Status: ${response.status}. Resposta:`, payload);
      throw new WhatsAppDeliveryError(
        `Erro ao enviar mensagem pelo WhatsApp. Status: ${response.status}`,
        response.status,
        payload
      );
    }

    return payload;
  },

  async getConnectStatus(oficinaId: number) {
    const apiUrl = process.env.EVOLUTION_API_URL?.trim();
    const apiKey = process.env.EVOLUTION_API_TOKEN?.trim();
    const baseInstance = process.env.EVOLUTION_API_INSTANCE?.trim() || "driveon";
    const instanceName = `${baseInstance}_${oficinaId}`;

    if (!apiUrl || !apiKey) {
      throw new Error("Serviço de WhatsApp não configurado.");
    }

    const baseUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

    // Tentar criar a instância (se já existir, a Evolution API retorna erro ou sucesso, mas podemos ignorar erros de "já existe")
    try {
      await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "apikey": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        }),
      });
    } catch (e) {
      console.log(`[WhatsAppService] Instância ${instanceName} já deve existir ou falhou ao criar:`, e);
    }

    // Buscar o status de conexão / QR Code
    const response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: {
        "apikey": apiKey,
      },
    });

    const payload = await response.json().catch(() => null);
    return payload;
  }
};

