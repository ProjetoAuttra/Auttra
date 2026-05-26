import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { generateSecret, verifySync as totpVerify, generateURI } from "otplib";
import { prisma } from "../../prisma/client.js";
import { getJwtSecret } from "../../config/env.js";

const APP_NAME = "DriveOn Admin";

function signAdminToken(usuario: { id: number; email: string; nome: string; tipo: string }) {
  const payload = { id: usuario.id, email: usuario.email, nome: usuario.nome, tipo: usuario.tipo };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: "8h" });
  return { token, usuario: payload };
}

function signPreAuthToken(userId: number) {
  return jwt.sign({ purpose: "2fa-pending", id: userId }, getJwtSecret(), { expiresIn: "5m" });
}

export const AdminAuthController = {
  async login(req: Request, res: Response) {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const senha = String(req.body?.senha ?? "");

      if (!email || !senha) {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
      }

      const usuario = await prisma.usuario.findFirst({
        where: { email, tipo: "sistema", deleted_at: null, status: "ativo" },
      });

      if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
        await bcrypt.compare(senha, "$2b$10$invalidsaltsimulatingcomparexxxxxxx");
        return res.status(401).json({ message: "E-mail ou senha inválidos." });
      }

      const totp_secret = (usuario as any).totp_secret as string | null;

      // 2FA ativo → pedir código
      if (totp_secret && !totp_secret.startsWith("pending:")) {
        return res.json({ requires2fa: true, pre_auth_token: signPreAuthToken(usuario.id) });
      }

      // 2FA não configurado ou pendente → forçar setup durante o login
      let secret: string;
      if (totp_secret?.startsWith("pending:")) {
        secret = totp_secret.slice("pending:".length);
      } else {
        secret = generateSecret();
        await (prisma.usuario as any).update({
          where: { id: usuario.id },
          data: { totp_secret: `pending:${secret}` },
        });
      }

      const otpauth = generateURI({ label: usuario.email, issuer: APP_NAME, secret });
      return res.json({
        requires2fa_setup: true,
        pre_auth_token: signPreAuthToken(usuario.id),
        otpauth,
      });
    } catch (err) {
      console.error("Erro no login admin:", err);
      return res.status(500).json({ message: "Erro interno ao autenticar." });
    }
  },

  async verify2fa(req: Request, res: Response) {
    try {
      const { pre_auth_token, code } = req.body ?? {};
      if (!pre_auth_token || !code) {
        return res.status(400).json({ message: "Token e código são obrigatórios." });
      }

      let payload: any;
      try {
        payload = jwt.verify(pre_auth_token, getJwtSecret());
      } catch {
        return res.status(401).json({ message: "Token expirado. Faça login novamente." });
      }

      if (payload.purpose !== "2fa-pending") {
        return res.status(401).json({ message: "Token inválido." });
      }

      const usuario = await prisma.usuario.findFirst({
        where: { id: payload.id, tipo: "sistema", deleted_at: null, status: "ativo" },
      });

      if (!usuario) return res.status(401).json({ message: "Usuário não encontrado." });

      const raw = (usuario as any).totp_secret as string | null;
      const activeSecret = raw && !raw.startsWith("pending:") ? raw : null;
      if (!activeSecret) return res.status(400).json({ message: "2FA não configurado." });

      const result = totpVerify({ token: String(code).replace(/\s/g, ""), secret: activeSecret });
      if (!result?.valid) {
        return res.status(401).json({ message: "Código inválido ou expirado." });
      }

      return res.json(signAdminToken(usuario));
    } catch (err) {
      console.error("Erro ao verificar 2FA:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  // Confirma o primeiro setup de 2FA feito durante o login (sem token completo)
  async completeFirstSetup2fa(req: Request, res: Response) {
    try {
      const { pre_auth_token, code } = req.body ?? {};
      if (!pre_auth_token || !code) {
        return res.status(400).json({ message: "Token e código são obrigatórios." });
      }

      let payload: any;
      try {
        payload = jwt.verify(pre_auth_token, getJwtSecret());
      } catch {
        return res.status(401).json({ message: "Token expirado. Faça login novamente." });
      }

      if (payload.purpose !== "2fa-pending") {
        return res.status(401).json({ message: "Token inválido." });
      }

      const usuario = await prisma.usuario.findFirst({
        where: { id: payload.id, tipo: "sistema", deleted_at: null, status: "ativo" },
      });

      if (!usuario) return res.status(401).json({ message: "Usuário não encontrado." });

      const raw = (usuario as any).totp_secret as string | null;
      if (!raw?.startsWith("pending:")) {
        return res.status(400).json({ message: "Nenhuma configuração de 2FA pendente." });
      }

      const secret = raw.slice("pending:".length);
      const result = totpVerify({ token: String(code).replace(/\s/g, ""), secret });
      if (!result?.valid) {
        return res.status(400).json({ message: "Código inválido. Verifique o Google Authenticator." });
      }

      await (prisma.usuario as any).update({
        where: { id: usuario.id },
        data: { totp_secret: secret },
      });

      return res.json(signAdminToken(usuario));
    } catch (err) {
      console.error("Erro ao completar setup de 2FA:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async setup2fa(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Não autorizado." });

      const usuario = await prisma.usuario.findFirst({
        where: { id: userId, tipo: "sistema", deleted_at: null },
      });
      if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

      const totp_secret = (usuario as any).totp_secret as string | null;
      if (totp_secret && !totp_secret.startsWith("pending:")) {
        return res.status(400).json({ message: "2FA já está ativo. Desative primeiro para reconfigurar." });
      }

      const secret = generateSecret();
      const otpauth = generateURI({ label: usuario.email, issuer: APP_NAME, secret });

      await (prisma.usuario as any).update({
        where: { id: userId },
        data: { totp_secret: `pending:${secret}` },
      });

      return res.json({ secret, otpauth });
    } catch (err) {
      console.error("Erro ao configurar 2FA:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async confirm2fa(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Não autorizado." });
      const { code } = req.body ?? {};
      if (!code) return res.status(400).json({ message: "Código obrigatório." });

      const usuario = await prisma.usuario.findFirst({
        where: { id: userId, tipo: "sistema", deleted_at: null },
      });
      if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

      const raw = (usuario as any).totp_secret as string | null;
      if (!raw?.startsWith("pending:")) {
        return res.status(400).json({ message: "Nenhuma configuração pendente. Inicie o setup primeiro." });
      }

      const secret = raw.slice("pending:".length);
      const r2 = totpVerify({ token: String(code).replace(/\s/g, ""), secret });
      if (!r2?.valid) {
        return res.status(400).json({ message: "Código inválido. Verifique o Google Authenticator." });
      }

      await (prisma.usuario as any).update({
        where: { id: userId },
        data: { totp_secret: secret },
      });

      return res.json({ message: "2FA ativado com sucesso." });
    } catch (err) {
      console.error("Erro ao confirmar 2FA:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async disable2fa(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Não autorizado." });
      const { code } = req.body ?? {};
      if (!code) return res.status(400).json({ message: "Código obrigatório para desativar." });

      const usuario = await prisma.usuario.findFirst({
        where: { id: userId, tipo: "sistema", deleted_at: null },
      });
      if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

      const totp_secret = (usuario as any).totp_secret as string | null;
      const activeSecret = totp_secret?.startsWith("pending:") ? null : totp_secret;
      if (!activeSecret) return res.status(400).json({ message: "2FA não está ativo." });

      const r3 = totpVerify({ token: String(code).replace(/\s/g, ""), secret: activeSecret });
      if (!r3?.valid) {
        return res.status(400).json({ message: "Código inválido." });
      }

      await (prisma.usuario as any).update({
        where: { id: userId },
        data: { totp_secret: null },
      });

      return res.json({ message: "2FA desativado." });
    } catch (err) {
      console.error("Erro ao desativar 2FA:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async alterarSenha(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Não autorizado." });

      const { senha_atual, nova_senha } = req.body ?? {};
      if (!senha_atual || !nova_senha) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias." });
      }

      const usuario = await prisma.usuario.findFirst({
        where: { id: userId, tipo: "sistema", deleted_at: null },
      });
      if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

      const senhaOk = await bcrypt.compare(senha_atual, usuario.senha);
      if (!senhaOk) return res.status(400).json({ message: "Senha atual incorreta." });

      const complexidade = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!complexidade.test(nova_senha)) {
        return res.status(400).json({
          message: "A nova senha deve ter no mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.",
        });
      }

      const hash = await bcrypt.hash(nova_senha, 10);
      await (prisma.usuario as any).update({ where: { id: userId }, data: { senha: hash } });

      return res.json({ message: "Senha alterada com sucesso." });
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async me(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Não autorizado." });

      const usuario = await prisma.usuario.findFirst({
        where: { id: userId, tipo: "sistema", deleted_at: null },
        select: { id: true, email: true, nome: true, tipo: true, totp_secret: true } as any,
      });
      if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

      const raw = (usuario as any).totp_secret as string | null;
      return res.json({
        usuario: {
          id: (usuario as any).id,
          email: (usuario as any).email,
          nome: (usuario as any).nome,
          tipo: (usuario as any).tipo,
          totp_enabled: !!raw && !raw.startsWith("pending:"),
        },
      });
    } catch (err) {
      console.error("Erro ao buscar usuário admin:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },
};
