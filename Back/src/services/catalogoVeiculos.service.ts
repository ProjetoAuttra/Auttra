import { prisma } from "../prisma/client.js";
import { CATALOGO_CURADO } from "../data/catalogoCurado.js";

const FIPE_URL = process.env.FIPE_API_URL?.replace(/\/+$/, "") || "https://parallelum.com.br/fipe/api/v2";
/** A FIPE limita a 50 requisições por minuto; 1,3 s entre chamadas fica abaixo disso. */
const INTERVALO_MS = 1300;
export const INTERVALO_SYNC_DIAS = 30;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const chaveCatalogo = (marca: string, modelo: string) =>
  `${semAcento(marca).trim().toLowerCase()}|${semAcento(modelo).trim().toLowerCase()}`;

const MARCAS_RENOMEADAS: Record<string, string> = {
  "GM - Chevrolet": "Chevrolet",
  "VW - VolksWagen": "Volkswagen",
  "Kia Motors": "Kia",
  "Caoa Chery/Chery": "Caoa Chery",
  "GREAT WALL": "GWM",
};
const SIGLAS = new Set(["DFSK", "JPX", "BRM", "TAC"]);

const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
const emCaixaAlta = (s: string) => s === s.toUpperCase() && s !== s.toLowerCase();

/** Nome da marca como o catálogo usa: sem prefixos da FIPE e sem caixa alta. */
export function normalizarMarcaFipe(nome: string): string {
  const n = nome.trim();
  if (MARCAS_RENOMEADAS[n]) return MARCAS_RENOMEADAS[n];
  if (emCaixaAlta(n) && n.length > 3 && !SIGLAS.has(n)) return titulo(n);
  return n;
}

/** Palavras que só fazem sentido junto da seguinte ("Grand Siena", "Land Cruiser"). */
const PREFIXOS_COMPOSTOS = new Set(["grand", "land", "novo", "new", "range", "classe", "serie", "série"]);
/** Nomes-base que viram composto com certa segunda palavra ("Corolla Cross"). */
const SEGUNDAS_PALAVRAS: Record<string, Set<string>> = {
  palio: new Set(["weekend"]),
  polo: new Set(["track"]),
  hilux: new Set(["sw4"]),
  corolla: new Set(["cross"]),
  onix: new Set(["plus"]),
};

const CARROCERIAS = new Set(["coupe", "cupe", "van", "sedan", "hatch", "pick-up", "furgao", "perua", "conversivel"]);

/**
 * A FIPE não separa modelo de versão ("AGILE LTZ 1.4 8V FlexPower 5p"). Fica o nome-base: a primeira
 * palavra, mais a segunda quando forma um nome composto. Devolve null para o que não parece modelo.
 */
export function reduzirModeloFipe(nomeFipe: string): string | null {
  const palavras = nomeFipe.replace(/[\/,]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!palavras.length) return null;

  let base = palavras[0];
  const proxima = palavras[1]?.toLowerCase();
  const primeira = base.toLowerCase();
  const composto =
    proxima &&
    (PREFIXOS_COMPOSTOS.has(primeira) || SEGUNDAS_PALAVRAS[primeira]?.has(proxima));
  if (composto) base = `${base} ${palavras[1]}`;
  // "Santa Fe" / "Grand Santa Fe": o "Fe" vem como terceira palavra ou como segunda.
  const ultimaBase = base.split(" ").pop()!.toLowerCase();
  const seguinte = palavras[base.split(" ").length] ? semAcento(palavras[base.split(" ").length]).toLowerCase() : undefined;
  if (ultimaBase === "santa" && seguinte === "fe") base = `${base} ${palavras[base.split(" ").length]}`;
  // "Ducato-10", "Ducato-15": a lotação não é parte do modelo (mas "A-10", "C-20" são).
  base = base.replace(/^(\p{L}{3,})-\d+$/u, "$1");

  // BMW: "118iA"/"320iA" é o mesmo 118i/320i com câmbio automático.
  base = base.replace(/^(\d{3})([ie])A$/i, (_, n, l) => `${n}${l.toLowerCase()}`);
  if (emCaixaAlta(base) && /[A-Z]{4,}/.test(base)) base = titulo(base);

  // Descarta cilindrada/ano soltos e nomes sem letra nem número identificável.
  if (base.length < 2 || base.length > 30 || /^\d+[.,]\d/.test(base) || !/[\p{L}\d]/u.test(base)) return null;
  // Abreviações ("Band.") e carrocerias soltas não são modelo.
  if (base.includes(".") || CARROCERIAS.has(semAcento(base).toLowerCase())) return null;
  return base;
}

export type EntradaCatalogo = { marca: string; modelo: string; origem: "curado" | "fipe" };

/** Agrupa e remove duplicatas (sem acento/caixa), mantendo o primeiro nome visto. */
export function deduplicar(entradas: EntradaCatalogo[]): (EntradaCatalogo & { chave: string })[] {
  const vistos = new Map<string, EntradaCatalogo & { chave: string }>();
  for (const e of entradas) {
    const chave = chaveCatalogo(e.marca, e.modelo);
    if (!vistos.has(chave)) vistos.set(chave, { ...e, chave });
  }
  return [...vistos.values()];
}

export function entradasCuradas(): EntradaCatalogo[] {
  return Object.entries(CATALOGO_CURADO).flatMap(([marca, modelos]) =>
    modelos.map((modelo) => ({ marca, modelo, origem: "curado" as const })),
  );
}

async function gravar(entradas: EntradaCatalogo[]) {
  const unicas = deduplicar(entradas);
  // skipDuplicates preserva o que já existe (inclusive o que alguém desativou).
  const r = await prisma.catalogo_veiculo.createMany({
    data: unicas.map(({ chave, marca, modelo, origem }) => ({ chave, marca, modelo, origem })),
    skipDuplicates: true,
  });
  return r.count;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fipe<T>(caminho: string): Promise<T> {
  const token = process.env.FIPE_TOKEN?.trim();
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch(`${FIPE_URL}${caminho}`, { headers: token ? { "X-Subscription-Token": token } : {} });
    if (res.status === 429) {
      await esperar(65_000);
      continue;
    }
    if (!res.ok) throw new Error(`FIPE ${caminho}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
  throw new Error(`FIPE ${caminho}: limite de requisições excedido.`);
}

export const CatalogoVeiculosService = {
  /** Marca -> modelos ativos, para o formulário de veículo. */
  async listar(): Promise<Record<string, string[]>> {
    const linhas = await prisma.catalogo_veiculo.findMany({
      where: { ativo: true },
      select: { marca: true, modelo: true },
      orderBy: [{ marca: "asc" }, { modelo: "asc" }],
    });
    const mapa: Record<string, string[]> = {};
    for (const { marca, modelo } of linhas) (mapa[marca] ??= []).push(modelo);
    return mapa;
  },

  /** Garante a base curada no banco (idempotente). */
  async semearCurado() {
    return gravar(entradasCuradas());
  },

  /** Lê marcas e modelos de carros da FIPE e acrescenta o que ainda não existe. */
  async sincronizarFipe() {
    await this.semearCurado();
    const marcas = await fipe<{ code: string; name: string }[]>("/cars/brands");
    const entradas: EntradaCatalogo[] = [];
    for (const m of marcas) {
      await esperar(INTERVALO_MS);
      const modelos = await fipe<{ code: string; name: string }[]>(`/cars/brands/${m.code}/models`);
      const marca = normalizarMarcaFipe(m.name);
      for (const mod of modelos) {
        const modelo = reduzirModeloFipe(mod.name);
        if (modelo) entradas.push({ marca, modelo, origem: "fipe" });
      }
    }
    const novos = await gravar(entradas);
    await prisma.catalogo_veiculo_sync.upsert({
      where: { id: 1 },
      update: { ultima_em: new Date() },
      create: { id: 1, ultima_em: new Date() },
    });
    return novos;
  },

  async precisaSincronizar(agora = new Date()) {
    const sync = await prisma.catalogo_veiculo_sync.findUnique({ where: { id: 1 } });
    if (!sync) return true;
    return agora.getTime() - sync.ultima_em.getTime() > INTERVALO_SYNC_DIAS * 86_400_000;
  },

  /**
   * Chamado na subida do servidor e a cada 24 h. Semeia a base curada na hora e só consulta a FIPE
   * quando a última sincronização passou de 30 dias; falha da FIPE nunca derruba o servidor.
   */
  iniciarSincronizacao() {
    if (process.env.NODE_ENV === "test" || process.env.CATALOGO_SYNC === "off") return;
    const rodar = async () => {
      try {
        await this.semearCurado();
        if (await this.precisaSincronizar()) {
          const novos = await this.sincronizarFipe();
          console.log(`[catalogo-veiculos] sincronizado com a FIPE: ${novos} novo(s).`);
        }
      } catch (err) {
        console.error("[catalogo-veiculos] falha na sincronização:", err);
      }
    };
    void rodar();
    setInterval(rodar, 24 * 3_600_000).unref();
  },
};
