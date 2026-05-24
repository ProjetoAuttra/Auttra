import { prisma } from "../prisma/client.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/env.js";

export const AuthService = {
  async login(email: string, senha: string) {
    const user = await prisma.usuario.findFirst({
      where: { email: email.trim().toLowerCase(), deleted_at: null, status: "ativo" },
    });

    if (!user) throw new Error("E-mail ou senha inválidos");

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) throw new Error("E-mail ou senha inválidos");

    const token = jwt.sign(
      { id: user.id, tipo: user.tipo },
      getJwtSecret(),
      { expiresIn: "8h" }
    );

    return {
      token,
      usuario: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        tipo: user.tipo,
      },
    };
  },
};
