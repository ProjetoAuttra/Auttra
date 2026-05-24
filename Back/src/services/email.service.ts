type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "DriveOn <onboarding@resend.dev>";
const VERIFIED_FROM = "DriveOn <no-reply@driveon.com.br>";

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function sendEmail({ to, subject, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new EmailDeliveryError("RESEND_API_KEY nao configurada.");
  }

  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new EmailDeliveryError(
      "Nao foi possivel enviar o e-mail pelo Resend. Verifique a API key, dominio/remetente e destinatario.",
      response.status,
      payload
    );
  }

  return payload;
}

export const emailSenders = {
  current: DEFAULT_FROM,
  futureVerifiedDomain: VERIFIED_FROM,
};
