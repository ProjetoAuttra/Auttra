import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";
import { normalizePermissions, type PermissionsMap } from "../permissions/accessProfiles.js";
import { PerfisAcessoService } from "../services/perfisAcesso.service.js";
import { getJwtSecret, getTurnstileSecret } from "../config/env.js";
import { PasswordResetService } from "../services/passwordReset.service.js";

function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

type AuthUsuario = {
  id: number;
  email: string;
  nome: string;
  tipo: string;
};

type AuthOficina = {
  id: number;
  nome?: string | null;
  logo_url?: string | null;
};

type AuthPerfil = {
  id?: number | null;
  nome?: string | null;
  legacyTipo: string;
  permissoes?: PermissionsMap;
};

async function resolvePerfil(oficinaId: number, perfilAcesso: any, legacyTipo: string): Promise<AuthPerfil> {
  if (perfilAcesso) {
    await PerfisAcessoService.ensureDefaults(oficinaId);
    const currentPerfil = await prisma.perfil_acesso.findFirst({
      where: { id: perfilAcesso.id, oficina_id: oficinaId, deleted_at: null },
    });
    const perfil = currentPerfil ?? perfilAcesso;
    return {
      id: perfil.id,
      nome: perfil.nome,
      legacyTipo,
      permissoes: normalizePermissions(perfil.permissoes),
    };
  }

  const fallbackKey = legacyTipo === "gestoroficina" || legacyTipo === "sistema" ? "proprietario" : "recepcao";
  const fallback = await PerfisAcessoService.findDefault(oficinaId, fallbackKey);
  return {
    id: fallback?.id ?? null,
    nome: fallback?.nome ?? legacyTipo,
    legacyTipo,
    permissoes: normalizePermissions(fallback?.permissoes),
  };
}

function signFinalToken(usuario: AuthUsuario & { foto_url?: string | null }, oficina: AuthOficina, perfil: AuthPerfil) {
  // JWT deve ser pequeno (enviado em cada header de requisição).
  // Dados apenas de autenticação/autorização, sem base64.
  const jwtPayload = {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    tipo: perfil.legacyTipo,
    oficinaId: oficina.id,
    oficina_id: oficina.id,
    perfilAcessoId: perfil.id ?? null,
    permissoes: perfil.permissoes ?? {},
  };

  // Payload completo para o body da resposta (pode conter base64).
  const usuarioPayload = {
    ...jwtPayload,
    oficina_nome: oficina.nome ?? null,
    oficina_logo_url: oficina.logo_url ?? null,
    perfilAcessoNome: perfil.nome ?? null,
    foto_url: usuario.foto_url ?? null,
  };

  const token = jwt.sign(jwtPayload, getJwtSecret(), {
    expiresIn: "8h",
  });

  return { token, usuario: usuarioPayload };
}

export async function updateFoto(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Nao autorizado." });

    const foto_url = req.body?.foto_url ?? null;
    if (foto_url !== null && typeof foto_url !== "string") {
      return res.status(400).json({ message: "foto_url invalida." });
    }
    if (foto_url && foto_url.length > 300_000) {
      return res.status(400).json({ message: "Imagem muito grande. Limite: 300KB." });
    }

    await prisma.usuario.update({ where: { id: userId }, data: { foto_url } });
    return res.json({ foto_url });
  } catch (err) {
    console.error("Erro ao atualizar foto:", err);
    return res.status(500).json({ message: "Erro interno ao atualizar foto." });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Nao autorizado." });

    const senhaAtual = String(req.body?.senha_atual ?? "");
    const novaSenha = String(req.body?.nova_senha ?? "");

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ message: "Senha atual e nova senha sao obrigatorias." });
    }
    if (novaSenha.length < 6) {
      return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres." });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) return res.status(404).json({ message: "Usuario nao encontrado." });

    const match = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!match) return res.status(400).json({ message: "Senha atual incorreta." });

    const novoHash = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({ where: { id: userId }, data: { senha: novoHash } });

    return res.json({ message: "Senha alterada com sucesso." });
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    return res.status(500).json({ message: "Erro interno ao alterar senha." });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const email = String(req.body?.email ?? "");

    if (!email.trim()) {
      return res.status(400).json({ message: "E-mail e obrigatorio." });
    }

    await PasswordResetService.requestReset(email);

    return res.json({
      message: "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.",
    });
  } catch (err) {
    console.error("Erro ao solicitar recuperacao de senha:", err);
    return res.status(500).json({ message: "Erro interno ao solicitar recuperacao de senha." });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const token = String(req.body?.token ?? "");
    const novaSenha = String(req.body?.nova_senha ?? "");

    await PasswordResetService.resetPassword(token, novaSenha);

    return res.json({ message: "Senha redefinida com sucesso." });
  } catch (err: any) {
    console.error("Erro ao redefinir senha:", err);
    return res.status(400).json({ message: err?.message ?? "Nao foi possivel redefinir a senha." });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const email = normalizeEmail(req.body?.email);
    const turnstileToken = String(req.body?.turnstileToken ?? "");

    if (!email) return res.status(400).json({ message: "E-mail e obrigatorio." });
    if (!turnstileToken) {
      return res.status(400).json({ message: "Verificacao de seguranca obrigatoria." });
    }

    let verifyData: { success?: boolean };
    try {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: getTurnstileSecret(),
          response: turnstileToken,
          remoteip: req.ip ?? "",
        }),
      });
      verifyData = await verifyRes.json();
    } catch (err) {
      console.error("Erro ao contatar o Cloudflare Turnstile:", err);
      return res.status(502).json({ message: "Nao foi possivel validar a verificacao de seguranca. Tente novamente." });
    }

    if (!verifyData.success) {
      return res.status(401).json({
        message: "Nao foi possivel confirmar que voce nao e um robo. Tente novamente.",
        code: "CAPTCHA_FAILED",
      });
    }

    const emailToken = jwt.sign({ purpose: "email-verified", email }, getJwtSecret(), { expiresIn: "10m" });
    return res.json({ emailToken });
  } catch (err) {
    console.error("Erro ao verificar e-mail:", err);
    return res.status(500).json({ message: "Erro interno ao verificar e-mail." });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const email = normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha ?? "");
    const emailToken = String(req.body?.emailToken ?? "");

    if (!email || !senha) {
      return res.status(400).json({ message: "E-mail e senha sao obrigatorios." });
    }

    let emailTokenPayload: { purpose?: string; email?: string } | null = null;
    try {
      emailTokenPayload = emailToken ? (jwt.verify(emailToken, getJwtSecret()) as any) : null;
    } catch {
      emailTokenPayload = null;
    }
    if (
      !emailTokenPayload ||
      emailTokenPayload.purpose !== "email-verified" ||
      emailTokenPayload.email !== email
    ) {
      return res.status(401).json({
        message: "Verificacao de e-mail expirada. Recomece o login.",
        code: "EMAIL_VERIFICATION_REQUIRED",
      });
    }

    const usuarios = await prisma.usuario.findMany({
      where: { email, deleted_at: null, status: "ativo" },
      include: {
        acessos: {
          where: { deleted_at: null, status: "ativo" },
          include: { oficina: true, perfil_acesso: true },
        },
      },
    });

    const matchedUsuarios: typeof usuarios = [];
    for (const candidate of usuarios) {
      if (await bcrypt.compare(senha, candidate.senha)) {
        matchedUsuarios.push(candidate);
      }
    }

    if (!matchedUsuarios.length) {
      await bcrypt.compare(senha, "$2b$10$invalidsaltsimulatingcomparexxxxxxx");
      return res.status(401).json({
        message: "E-mail ou senha invalidos.",
      });
    }

    const officeOptions = matchedUsuarios.flatMap((usuario) => {
      return usuario.acessos.map((acesso) => ({
        usuario,
        userId: usuario.id,
        id: acesso.oficina_id,
        nome: acesso.oficina?.nome ?? `Oficina ${acesso.oficina_id}`,
        logo_url: acesso.oficina?.logo_url ?? null,
        perfil: acesso.perfil,
        perfilAcessoId: acesso.perfil_acesso_id,
        perfilAcessoNome: acesso.perfil_acesso?.nome,
      }));
    });

    const officesById = new Map<number, (typeof officeOptions)[number]>();
    for (const office of officeOptions) {
      if (!officesById.has(office.id)) officesById.set(office.id, office);
    }

    const offices = Array.from(officesById.values());
    const oficinas = offices.map(({ id, nome, logo_url, perfil, perfilAcessoId, perfilAcessoNome }) => ({
      id,
      nome,
      logo_url,
      perfil,
      perfilAcessoId,
      perfilAcessoNome,
    }));

    if (!oficinas.length) {
      return res.status(403).json({ message: "Usuario sem acesso a nenhuma oficina." });
    }

    if (oficinas.length > 1) {
      const selectionToken = jwt.sign(
        {
          purpose: "office-selection",
          allowed: offices.map((office) => ({
            userId: office.userId,
            oficinaId: office.id,
          })),
        },
        getJwtSecret(),
        { expiresIn: "15m" }
      );

      return res.json({
        requiresOfficeSelection: true,
        selectionToken,
        usuario: {
          id: matchedUsuarios[0].id,
          email: matchedUsuarios[0].email,
          nome: matchedUsuarios[0].nome,
          tipo: matchedUsuarios[0].tipo,
        },
        oficinas,
      });
    }

    const selected = offices[0];
    const oficina = { id: selected.id, nome: selected.nome, logo_url: selected.logo_url };
    const perfil = await resolvePerfil(selected.id, selected.usuario.acessos[0]?.perfil_acesso, selected.perfil);
    return res.json({
      ...signFinalToken(selected.usuario, oficina, perfil),
      oficinas,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ message: "Erro interno ao autenticar." });
  }
}

export async function selectOficina(req: Request, res: Response) {
  try {
    const selectionToken = String(req.body?.selectionToken ?? "");
    const oficinaId = Number(req.body?.oficina_id ?? req.body?.oficinaId);

    if (!selectionToken || !oficinaId) {
      return res.status(400).json({ message: "Token de selecao e oficina_id sao obrigatorios." });
    }
    const decoded = jwt.verify(selectionToken, getJwtSecret()) as {
      userId?: number;
      purpose: string;
      allowed?: { userId: number; oficinaId: number }[];
    };

    if (decoded.purpose !== "office-selection") {
      return res.status(401).json({ message: "Token invalido." });
    }

    const allowed = decoded.allowed?.find((item) => item.oficinaId === oficinaId);
    const userId = allowed?.userId ?? decoded.userId;
    if (!userId) {
      return res.status(403).json({ message: "Usuario sem acesso a esta oficina." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        acessos: {
          where: { oficina_id: oficinaId, deleted_at: null, status: "ativo" },
          include: { oficina: true, perfil_acesso: true },
        },
      },
    });

    if (!usuario || usuario.deleted_at || usuario.status !== "ativo") {
      return res.status(401).json({ message: "Usuario invalido." });
    }

    const acesso = usuario.acessos[0];

    if (!acesso) {
      return res.status(403).json({ message: "Usuario sem acesso a esta oficina." });
    }

    const perfil = await resolvePerfil(oficinaId, acesso.perfil_acesso, acesso.perfil);
    return res.json(signFinalToken(usuario, acesso.oficina, perfil));
  } catch (err) {
    console.error("Erro ao selecionar oficina:", err);
    return res.status(401).json({ message: "Nao foi possivel selecionar a oficina." });
  }
}
