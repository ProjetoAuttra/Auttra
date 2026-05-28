import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { generateSecret, verifySync as totpVerify, generateURI } from "otplib";
import { prisma } from "../../prisma/client.js";
import { getJwtSecret } from "../../config/env.js";
import { AdminAuditService } from "../../services/admin/audit.service.js";

const APP_NAME = "DriveOn Admin";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function signAdminToken(usuario: { id: number; email: string; nome: string; tipo: string; last_login_at?: Date | null }) {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    tipo: usuario.tipo,
    last_login_at: usuario.last_login_at ?? null,
  };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: "2h" });
  return { token, usuario: payload };
}

function signPreAuthToken(userId: number) {
  return jwt.sign({ purpose: "2fa-pending", id: userId }, getJwtSecret(), { expiresIn: "5m" });
}

function requestIp(req: Request) {
  return req.ip ?? req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? null;
}

async function registerFailedLogin(usuario: { id: number; failed_login_attempts?: number | null }) {
  const attempts = (usuario.failed_login_attempts ?? 0) + 1;
  const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { failed_login_attempts: attempts, locked_until: lockedUntil } as any,
  });
  return lockedUntil;
}

async function completeAdminLogin(req: Request, usuario: { id: number; email: string; nome: string; tipo: string }) {
  const updated = await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date(),
      last_login_ip: requestIp(req),
      last_login_user_agent: req.get("user-agent") ?? null,
    } as any,
    select: { id: true, email: true, nome: true, tipo: true, last_login_at: true } as any,
  });

  await AdminAuditService.log({
    req,
    actorId: usuario.id,
    action: "admin.login",
    entityType: "usuario",
    entityId: usuario.id,
    message: "Login administrativo concluído.",
  });

  return signAdminToken(updated as any);
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

      if ((usuario as any)?.locked_until && (usuario as any).locked_until > new Date()) {
        return res.status(423).json({ message: "Acesso bloqueado temporariamente. Tente novamente em alguns minutos." });
      }

      if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
        await bcrypt.compare(senha, "$2b$10$invalidsaltsimulatingcomparexxxxxxx");
        if (usuario) {
          const lockedUntil = await registerFailedLogin(usuario as any);
          await AdminAuditService.log({
            req,
            actorId: usuario.id,
            action: lockedUntil ? "admin.login_locked" : "admin.login_failed",
            entityType: "usuario",
            entityId: usuario.id,
            message: lockedUntil ? "Administrador bloqueado por tentativas inválidas." : "Tentativa inválida de login administrativo.",
          });
        }
        return res.status(401).json({ message: "E-mail ou senha inválidos." });
      }

      const totpSecret = (usuario as any).totp_secret as string | null;

      if (totpSecret && !totpSecret.startsWith("pending:")) {
        return res.json({ requires2fa: true, pre_auth_token: signPreAuthToken(usuario.id) });
      }

      let secret: string;
      if (totpSecret?.startsWith("pending:")) {
        secret = totpSecret.slice("pending:".length);
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
      if ((usuario as any).locked_until && (usuario as any).locked_until > new Date()) {
        return res.status(423).json({ message: "Acesso bloqueado temporariamente. Tente novamente em alguns minutos." });
      }

      const raw = (usuario as any).totp_secret as string | null;
      const activeSecret = raw && !raw.startsWith("pending:") ? raw : null;
      if (!activeSecret) return res.status(400).json({ message: "2FA não configurado." });

      const result = totpVerify({ token: String(code).replace(/\s/g, ""), secret: activeSecret, epochTolerance: 30 });
      if (!result?.valid) {
        const lockedUntil = await registerFailedLogin(usuario as any);
        await AdminAuditService.log({
          req,
          actorId: usuario.id,
          action: lockedUntil ? "admin.2fa_locked" : "admin.2fa_failed",
          entityType: "usuario",
          entityId: usuario.id,
          message: lockedUntil ? "Administrador bloqueado por códigos 2FA inválidos." : "Código 2FA administrativo inválido.",
        });
        return res.status(401).json({ message: "Código inválido ou expirado." });
      }

      return res.json(await completeAdminLogin(req, usuario));
    } catch (err) {
      console.error("Erro ao verificar 2FA:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

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
      const result = totpVerify({ token: String(code).replace(/\s/g, ""), secret, epochTolerance: 30 });
      if (!result?.valid) {
        return res.status(400).json({ message: "Código inválido. Verifique o Google Authenticator." });
      }

      await (prisma.usuario as any).update({
        where: { id: usuario.id },
        data: { totp_secret: secret },
      });

      await AdminAuditService.log({
        req,
        actorId: usuario.id,
        action: "admin.2fa_setup",
        entityType: "usuario",
        entityId: usuario.id,
        message: "2FA administrativo configurado.",
      });

      return res.json(await completeAdminLogin(req, usuario));
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

      const totpSecret = (usuario as any).totp_secret as string | null;
      if (totpSecret && !totpSecret.startsWith("pending:")) {
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

      await AdminAuditService.log({
        req,
        action: "admin.2fa_confirm",
        entityType: "usuario",
        entityId: userId,
        message: "2FA administrativo confirmado.",
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

      const totpSecret = (usuario as any).totp_secret as string | null;
      const activeSecret = totpSecret?.startsWith("pending:") ? null : totpSecret;
      if (!activeSecret) return res.status(400).json({ message: "2FA não está ativo." });

      const r3 = totpVerify({ token: String(code).replace(/\s/g, ""), secret: activeSecret });
      if (!r3?.valid) {
        return res.status(400).json({ message: "Código inválido." });
      }

      await (prisma.usuario as any).update({
        where: { id: userId },
        data: { totp_secret: null },
      });

      await AdminAuditService.log({
        req,
        action: "admin.2fa_disable",
        entityType: "usuario",
        entityId: userId,
        message: "2FA administrativo desativado.",
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

      await AdminAuditService.log({
        req,
        action: "admin.password_change",
        entityType: "usuario",
        entityId: userId,
        message: "Senha do administrador alterada.",
      });

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
        select: {
          id: true,
          email: true,
          nome: true,
          tipo: true,
          totp_secret: true,
          last_login_at: true,
          last_login_ip: true,
          last_login_user_agent: true,
        } as any,
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
          last_login_at: (usuario as any).last_login_at,
          last_login_ip: (usuario as any).last_login_ip,
          last_login_user_agent: (usuario as any).last_login_user_agent,
        },
      });
    } catch (err) {
      console.error("Erro ao buscar usuário admin:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },
};
