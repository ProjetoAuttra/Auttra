import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../prisma/client.js";
import { EmailDeliveryError, sendEmail } from "./email.service.js";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 60;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(token: string, fallbackOrigin?: string) {
  const corsOrigin = process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()).find(Boolean);
  const baseUrl =
    process.env.PASSWORD_RESET_URL_BASE?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    corsOrigin ||
    fallbackOrigin ||
    "http://localhost:5173";

  return `${baseUrl.replace(/\/+$/, "")}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

function passwordResetEmailHtml(resetUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 16px;">Recuperação de senha do DriveOn</h2>
      <p>Foi solicitada uma recuperação de senha para a sua conta do DriveOn.</p>
      <p>Para criar uma nova senha, acesse o link seguro abaixo:</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; background: #2563EB; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;">
          Redefinir senha
        </a>
      </p>
      <p>Este link expira em ${TOKEN_TTL_MINUTES} minutos.</p>
      <p>Se você não solicitou esta recuperação, ignore este e-mail.</p>
    </div>
  `;
}

export const PasswordResetService = {
  async requestReset(email: string, fallbackOrigin?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("E-mail e obrigatorio.");

    const usuario = await prisma.usuario.findFirst({
      where: { email: normalizedEmail, deleted_at: null, status: "ativo" },
      select: { id: true, email: true },
    });

    if (!usuario) return { sent: false };

    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.password_reset_token.updateMany({
      where: { usuario_id: usuario.id, used_at: null },
      data: { used_at: new Date() },
    });

    await prisma.password_reset_token.create({
      data: {
        usuario_id: usuario.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    const resetUrl = buildResetUrl(token, fallbackOrigin);

    try {
      await sendEmail({
        to: usuario.email,
        subject: "Recuperação de senha do DriveOn",
        html: passwordResetEmailHtml(resetUrl),
      });
    } catch (error) {
      await prisma.password_reset_token.updateMany({
        where: { token_hash: tokenHash, used_at: null },
        data: { used_at: new Date() },
      });

      if (error instanceof EmailDeliveryError) throw error;
      throw new EmailDeliveryError("Nao foi possivel enviar o e-mail de recuperacao.");
    }

    return { sent: true };
  },

  async resetPassword(token: string, novaSenha: string) {
    if (!token) throw new Error("Token obrigatorio.");
    if (!novaSenha || novaSenha.length < 6) {
      throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
    }

    const tokenHash = hashToken(token);
    const resetToken = await prisma.password_reset_token.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!resetToken || resetToken.used_at || resetToken.expires_at <= new Date()) {
      throw new Error("Link de recuperacao invalido ou expirado.");
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: resetToken.usuario_id },
        data: { senha: senhaHash },
      }),
      prisma.password_reset_token.update({
        where: { id: resetToken.id },
        data: { used_at: new Date() },
      }),
    ]);
  },
};
