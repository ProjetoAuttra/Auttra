import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../prisma/client.js";
import { EmailDeliveryError, sendEmail } from "./email.service.js";
import { invalidarTokens, limparCacheSessao } from "./sessao.service.js";
import { SENHA_FORTE_MENSAGEM, senhaForte } from "../utils/senhaForte.js";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 60;
const CONVITE_TTL_MINUTES = 7 * 24 * 60;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Usuario do painel (tipo "sistema") cria a senha no proprio admin; os demais, no app das oficinas.
function buildResetUrl(token: string, tipo: string) {
  const baseUrl = tipo === "sistema"
    ? process.env.ADMIN_URL_BASE?.trim() || "http://localhost:8081"
    : process.env.PASSWORD_RESET_URL_BASE?.trim() ||
      process.env.FRONTEND_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      "http://localhost:5173";

  return `${baseUrl.replace(/\/+$/, "")}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

function passwordResetEmailHtml(resetUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 16px;">Recuperação de senha do Auttra</h2>
      <p>Foi solicitada uma recuperação de senha para a sua conta do Auttra.</p>
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

function conviteEmailHtml(resetUrl: string, tipo: string) {
  const intro = tipo === "sistema"
    ? "Você recebeu acesso ao painel administrativo do Auttra."
    : "Sua oficina foi cadastrada no Auttra e você foi definido como proprietário da conta.";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 16px;">Bem-vindo ao Auttra</h2>
      <p>${intro}</p>
      <p>Para acessar, crie sua senha pelo link seguro abaixo:</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; background: #2563EB; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;">
          Criar minha senha
        </a>
      </p>
      <p>Este link expira em 7 dias.</p>
    </div>
  `;
}

export const PasswordResetService = {
  async requestReset(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("E-mail e obrigatorio.");

    const usuario = await prisma.usuario.findFirst({
      where: { email: normalizedEmail, deleted_at: null, status: "ativo" },
      select: { id: true, email: true, tipo: true },
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

    const resetUrl = buildResetUrl(token, usuario.tipo);

    try {
      await sendEmail({
        to: usuario.email,
        subject: "Recuperação de senha do Auttra",
        html: passwordResetEmailHtml(resetUrl),
      });
      return { sent: true };
    } catch {
      return { sent: false };
    }
  },

  // Usado pelo painel admin: redefinicao de senha (link de 60 min) ou convite de usuario novo (link de 7 dias).
  async createResetForUser(usuarioId: number, { convite = false }: { convite?: boolean } = {}) {
    const usuario = await prisma.usuario.findFirst({
      where: { id: usuarioId, deleted_at: null, status: "ativo" },
      select: { id: true, email: true, tipo: true },
    });

    if (!usuario) throw new Error("Usuário não encontrado.");

    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(token);
    const ttlMinutes = convite ? CONVITE_TTL_MINUTES : TOKEN_TTL_MINUTES;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

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

    const resetUrl = buildResetUrl(token, usuario.tipo);
    let emailSent = true;

    try {
      await sendEmail({
        to: usuario.email,
        subject: convite ? "Seu acesso ao Auttra" : "Redefinição de senha do Auttra",
        html: convite ? conviteEmailHtml(resetUrl, usuario.tipo) : passwordResetEmailHtml(resetUrl),
      });
    } catch {
      emailSent = false;
    }

    return { email: usuario.email, reset_url: resetUrl, expires_at: expiresAt, email_sent: emailSent };
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

    const usuario = await prisma.usuario.findUnique({
      where: { id: resetToken.usuario_id },
      select: { tipo: true },
    });
    if (usuario?.tipo === "sistema" && !senhaForte(novaSenha)) {
      throw new Error(SENHA_FORTE_MENSAGEM);
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: resetToken.usuario_id },
        data: { senha: senhaHash, ...invalidarTokens },
      }),
      prisma.password_reset_token.update({
        where: { id: resetToken.id },
        data: { used_at: new Date() },
      }),
    ]);
    limparCacheSessao(resetToken.usuario_id);
  },
};
