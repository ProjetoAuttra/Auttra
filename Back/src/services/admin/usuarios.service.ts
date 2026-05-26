import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../../prisma/client.js";
import { sendEmail, EmailDeliveryError } from "../email.service.js";

function senhaTemporariaHtml(email: string, senha: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 16px;">Acesso ao DriveOn</h2>
      <p>Uma nova senha temporária foi gerada para a sua conta (<strong>${email}</strong>).</p>
      <p style="font-size: 18px; font-weight: bold; letter-spacing: 2px;">${senha}</p>
      <p>Por segurança, altere sua senha após o primeiro acesso.</p>
    </div>
  `;
}

export const UsuariosAdminService = {
  async listar(oficina_id?: number) {
    const where = oficina_id
      ? { deleted_at: null, tipo: { not: "sistema" as const }, acessos: { some: { oficina_id, deleted_at: null } } }
      : { deleted_at: null, tipo: { not: "sistema" as const } };

    return prisma.usuario.findMany({
      where,
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
        created_at: true,
        acessos: {
          where: { deleted_at: null },
          select: { oficina_id: true, perfil: true, oficina: { select: { id: true, nome: true } } },
        },
      },
      orderBy: { created_at: "desc" },
    });
  },

  async updateEmail(id: number, novoEmail: string) {
    const email = novoEmail.trim().toLowerCase();

    const existente = await prisma.usuario.findFirst({ where: { email, deleted_at: null } });
    if (existente && existente.id !== id) throw new Error("E-mail já está em uso por outro usuário.");

    const usuario = await prisma.usuario.findFirst({ where: { id, deleted_at: null } });
    if (!usuario) throw new Error("Usuário não encontrado.");

    return prisma.usuario.update({ where: { id }, data: { email } });
  },

  async resetSenha(id: number) {
    const usuario = await prisma.usuario.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, email: true },
    });
    if (!usuario) throw new Error("Usuário não encontrado.");

    // charset sem caracteres ambíguos (0/O, l/1/I)
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let senhaTemporaria = "";
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) senhaTemporaria += charset[bytes[i] % charset.length];

    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
    await prisma.usuario.update({ where: { id }, data: { senha: senhaHash } });

    // envia email (best effort — não falha se Resend não estiver configurado)
    try {
      await sendEmail({
        to: usuario.email,
        subject: "Nova senha temporária — DriveOn",
        html: senhaTemporariaHtml(usuario.email, senhaTemporaria),
      });
    } catch {
      // email falhou mas senha foi atualizada — admin verá a senha na tela
    }

    return { email: usuario.email, senha_temporaria: senhaTemporaria };
  },
};
