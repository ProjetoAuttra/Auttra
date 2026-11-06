import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "../generated/prisma/client.js";
import { getJwtSecret } from "../config/env.js";
import { prisma } from "../prisma/client.js";
import type { CadastroInput } from "../schemas/cadastro.schema.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { HttpError } from "../utils/httpError.js";
import { ensureProfiles } from "./admin/oficinas.service.js";
import { AdminAuditService } from "./admin/audit.service.js";
import { fimDoTeste } from "./assinatura.service.js";
import { sendEmail } from "./email.service.js";

export const EMAIL_JA_CADASTRADO = "EMAIL_JA_CADASTRADO";
const emailJaCadastrado = () =>
  new HttpError("Esse e-mail já tem conta. Entre ou recupere a senha.", 409, EMAIL_JA_CADASTRADO);

const CONFIRMACAO_VALIDADE = "30d";
const PROPOSITO_CONFIRMACAO = "confirmar-email";

function appUrl() {
  const base =
    process.env.FRONTEND_URL?.trim() || process.env.APP_URL?.trim() || "http://localhost:5173";
  return base.replace(/\/+$/, "");
}

type Origem = { ip?: string | null; userAgent?: string | null };

// ---------------------------------------------------------------------------------------------
// Confirmação de e-mail: token assinado (sem tabela). Só vale para o mesmo e-mail que o gerou,
// então trocar o e-mail da conta invalida os links antigos.
// ---------------------------------------------------------------------------------------------

export const ConfirmacaoEmailService = {
  gerarToken(usuario: { id: number; email: string }) {
    return jwt.sign({ purpose: PROPOSITO_CONFIRMACAO, sub: String(usuario.id), email: usuario.email }, getJwtSecret(), {
      expiresIn: CONFIRMACAO_VALIDADE,
    });
  },

  link(usuario: { id: number; email: string }) {
    return `${appUrl()}/confirmar-email?token=${encodeURIComponent(this.gerarToken(usuario))}`;
  },

  /** Marca o e-mail como confirmado. Confirmar de novo não é erro: devolve a data da primeira vez. */
  async confirmar(token: unknown) {
    const invalido = () =>
      new HttpError("Link de confirmação inválido ou expirado. Peça um novo dentro do sistema.", 400, "CONFIRMACAO_INVALIDA");
    if (typeof token !== "string" || !token) throw invalido();

    let payload: { purpose?: string; sub?: string; email?: string };
    try {
      payload = jwt.verify(token, getJwtSecret()) as typeof payload;
    } catch {
      throw invalido();
    }
    const id = Number(payload.sub);
    if (payload.purpose !== PROPOSITO_CONFIRMACAO || !Number.isInteger(id) || !payload.email) throw invalido();

    const usuario = await prisma.usuario.findFirst({
      where: { id, email: payload.email, deleted_at: null },
      select: { id: true, email_confirmado_em: true },
    });
    if (!usuario) throw invalido();
    if (usuario.email_confirmado_em) return { confirmadoEm: usuario.email_confirmado_em };

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: { email_confirmado_em: new Date() },
      select: { email_confirmado_em: true },
    });
    return { confirmadoEm: atualizado.email_confirmado_em! };
  },

  /** Reenvia o link para quem está logado e ainda não confirmou. */
  async reenviar(usuarioId: number) {
    const usuario = await prisma.usuario.findFirst({
      where: { id: usuarioId, deleted_at: null },
      select: { id: true, nome: true, email: true, email_confirmado_em: true },
    });
    if (!usuario) throw new HttpError("Usuário não encontrado.", 404);
    if (usuario.email_confirmado_em) return { jaConfirmado: true, enviado: false };

    try {
      await sendEmail({
        to: usuario.email,
        subject: "Confirme seu e-mail no Auttra",
        html: emailConfirmacaoHtml(usuario.nome, this.link(usuario)),
      });
      return { jaConfirmado: false, enviado: true };
    } catch (err) {
      console.error("Erro ao reenviar a confirmação de e-mail:", err);
      throw new HttpError("Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.", 502);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// E-mails
// ---------------------------------------------------------------------------------------------

const botao = (href: string, texto: string) => `
  <p>
    <a href="${escapeHtml(href)}" style="display: inline-block; padding: 12px 18px; background: #2563EB; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;">
      ${texto}
    </a>
  </p>`;

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

function emailBoasVindasHtml(nome: string, oficina: string, linkConfirmacao: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 16px;">Bem-vindo ao Auttra, ${escapeHtml(primeiroNome(nome))}!</h2>
      <p>A conta da <b>${escapeHtml(oficina)}</b> está pronta, e você tem 7 dias para testar tudo, sem pagar nada.</p>
      <p>Confirme seu e-mail para a gente saber que ele é seu:</p>
      ${botao(linkConfirmacao, "Confirmar meu e-mail")}
      <p>Para começar, vale completar os dados da oficina em Configurações (endereço e logo saem no orçamento),
      cadastrar seus serviços e mandar o primeiro orçamento.</p>
      <p>Qualquer dúvida, é só responder este e-mail.</p>
    </div>`;
}

function emailConfirmacaoHtml(nome: string, linkConfirmacao: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 16px;">Confirme seu e-mail</h2>
      <p>Olá, ${escapeHtml(primeiroNome(nome))}. Clique no botão abaixo para confirmar o e-mail da sua conta do Auttra.</p>
      ${botao(linkConfirmacao, "Confirmar meu e-mail")}
      <p>Se não foi você quem pediu, ignore este e-mail.</p>
    </div>`;
}

function emailAvisoEquipeHtml(d: { nome: string; email: string; whatsapp: string; oficina: string; oficinaId: number; campanha: Record<string, string> | null }) {
  const linhas: [string, string][] = [
    ["Oficina", `${d.oficina} (#${d.oficinaId})`],
    ["Responsável", d.nome],
    ["E-mail", d.email],
    ["WhatsApp", d.whatsapp],
    ...Object.entries(d.campanha ?? {}).map(([k, v]) => [k, v] as [string, string]),
  ];
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 16px;">Novo cadastro pelo site</h2>
      <table cellpadding="4">${linhas.map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v)}</td></tr>`).join("")}</table>
      <p>Teste grátis de 7 dias começou agora.</p>
    </div>`;
}

/** Destinatários do aviso de novo cadastro (CADASTRO_AVISO_EMAIL, separados por vírgula). Vazio: não avisa. */
function equipe() {
  return (process.env.CADASTRO_AVISO_EMAIL ?? "").split(",").map((e) => e.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------------------------

export const CadastroService = {
  /**
   * Cria a oficina em teste de 7 dias, os perfis padrão, o proprietário com a senha escolhida e o vínculo,
   * tudo numa transação. O e-mail entra sem confirmação: a pessoa usa na hora e confirma depois.
   */
  async cadastrar(input: CadastroInput, origem: Origem = {}, agora: Date = new Date()) {
    if (await prisma.usuario.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw emailJaCadastrado();
    }

    const senhaHash = await bcrypt.hash(input.senha, 10);

    let criado;
    try {
      criado = await prisma.$transaction(async (tx) => {
        const oficina = await tx.oficina.create({
          data: {
            nome: input.oficina,
            whatsapp: input.whatsapp,
            assinatura_status: "teste",
            teste_termina_em: fimDoTeste(agora),
            origem: "cadastro",
            origem_campanha: input.campanha ?? Prisma.DbNull,
          },
        });
        const perfil = await ensureProfiles(tx, oficina.id);
        const usuario = await tx.usuario.create({
          data: {
            nome: input.nome,
            email: input.email,
            senha: senhaHash,
            tipo: "gestoroficina",
            status: "ativo",
            telefone: input.whatsapp,
            email_confirmado_em: null,
          },
        });
        await tx.usuario_oficina.create({
          data: {
            usuario_id: usuario.id,
            oficina_id: oficina.id,
            perfil: "gestoroficina",
            perfil_acesso_id: perfil.id,
            status: "ativo",
          },
        });
        const oficinaFinal = await tx.oficina.update({
          where: { id: oficina.id },
          data: { gestor_usuario_id: usuario.id },
        });
        return { oficina: oficinaFinal, usuario, perfil };
      });
    } catch (err) {
      // Dois cadastros simultâneos com o mesmo e-mail: o segundo cai na unicidade do banco.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw emailJaCadastrado();
      throw err;
    }

    const { oficina, usuario } = criado;

    await AdminAuditService.log({
      actorId: usuario.id,
      oficinaId: oficina.id,
      action: "oficina.cadastro_site",
      entityType: "oficina",
      entityId: oficina.id,
      message: `Oficina ${oficina.nome} cadastrada pelo site por ${usuario.nome} (${usuario.email}). Teste grátis até ${oficina.teste_termina_em?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
      metadata: { campanha: input.campanha ?? null, ip: origem.ip ?? null, user_agent: origem.userAgent ?? null },
    }).catch((err) => console.error("Erro ao registrar o cadastro no histórico:", err));

    // E-mails não seguram a resposta: a pessoa entra no app mesmo se o Resend estiver fora.
    void this.enviarEmails(criado, input.campanha ?? null);

    return criado;
  },

  async enviarEmails(
    { oficina, usuario }: { oficina: { id: number; nome: string }; usuario: { id: number; nome: string; email: string; telefone: string | null } },
    campanha: Record<string, string> | null
  ) {
    const envios = [
      sendEmail({
        to: usuario.email,
        subject: "Bem-vindo ao Auttra: confirme seu e-mail",
        html: emailBoasVindasHtml(usuario.nome, oficina.nome, ConfirmacaoEmailService.link(usuario)),
      }),
    ];
    const destinos = equipe();
    if (destinos.length) {
      envios.push(sendEmail({
        to: destinos,
        subject: `Novo cadastro: ${oficina.nome}`,
        html: emailAvisoEquipeHtml({
          nome: usuario.nome,
          email: usuario.email,
          whatsapp: usuario.telefone ?? "",
          oficina: oficina.nome,
          oficinaId: oficina.id,
          campanha,
        }),
      }));
    }
    const resultados = await Promise.allSettled(envios);
    for (const r of resultados) {
      if (r.status === "rejected") console.error("Erro ao enviar e-mail do cadastro:", r.reason);
    }
  },
};
