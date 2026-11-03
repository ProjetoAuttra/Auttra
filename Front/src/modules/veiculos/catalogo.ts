import * as React from "react";
import api from "../../api/api";

/** Repositório de veículos do mercado brasileiro: sugere modelos pela marca e a marca pelo modelo. */
export const CATALOGO_VEICULOS: Record<string, string[]> = {
  Audi: ["A3", "A4", "A5", "Q3", "Q5", "Q7", "e-tron"],
  BMW: ["118i", "320i", "330e", "X1", "X3", "X5", "iX3"],
  BYD: ["Dolphin", "Dolphin Mini", "Seal", "Song Plus", "Tan", "Yuan Plus"],
  Chery: ["Arrizo 6", "Tiggo 5X", "Tiggo 7", "Tiggo 8"],
  Chevrolet: [
    "Agile", "Astra", "Blazer", "Camaro", "Celta", "Classic", "Cobalt", "Corsa", "Cruze", "Equinox",
    "Montana", "Onix", "Onix Plus", "Prisma", "S10", "Spin", "Tracker", "Trailblazer", "Vectra", "Zafira",
  ],
  Citroën: ["Aircross", "C3", "C4 Cactus", "C4 Lounge", "Jumpy", "Xsara Picasso"],
  Fiat: [
    "Argo", "Cronos", "Doblò", "Ducato", "Fastback", "Fiorino", "Grand Siena", "Idea", "Mobi",
    "Palio", "Pulse", "Punto", "Siena", "Strada", "Toro", "Uno", "Weekend",
  ],
  Ford: [
    "Bronco Sport", "EcoSport", "Edge", "Escort", "Fiesta", "Focus", "Fusion", "Ka", "Maverick",
    "Mustang", "Ranger", "Territory", "Transit",
  ],
  Honda: ["Accord", "City", "Civic", "CR-V", "Fit", "HR-V", "WR-V", "ZR-V"],
  Hyundai: ["Azera", "Creta", "HB20", "HB20S", "i30", "ix35", "Santa Fe", "Tucson", "Veloster"],
  Jeep: ["Commander", "Compass", "Grand Cherokee", "Renegade", "Wrangler"],
  Kia: ["Cerato", "Niro", "Picanto", "Sorento", "Soul", "Sportage", "Stonic"],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Evoque", "Freelander", "Range Rover", "Velar"],
  "Mercedes-Benz": ["A 200", "C 180", "C 200", "Classe A", "GLA", "GLC", "Sprinter"],
  Mitsubishi: ["ASX", "Eclipse Cross", "L200 Triton", "Lancer", "Outlander", "Pajero Sport", "Pajero TR4"],
  Nissan: ["Frontier", "Kicks", "March", "Sentra", "Tiida", "Versa"],
  Peugeot: ["2008", "206", "207", "208", "3008", "307", "308", "408", "Partner"],
  Renault: ["Captur", "Clio", "Duster", "Duster Oroch", "Fluence", "Kwid", "Logan", "Master", "Sandero", "Stepway"],
  Toyota: ["Camry", "Corolla", "Corolla Cross", "Etios", "Hilux", "Prius", "RAV4", "SW4", "Yaris"],
  Volkswagen: [
    "Amarok", "Fox", "Gol", "Golf", "Jetta", "Nivus", "Parati", "Passat", "Polo", "Saveiro",
    "Santana", "T-Cross", "Taos", "Tiguan", "Up!", "Virtus", "Voyage",
  ],
  Volvo: ["C40", "S60", "XC40", "XC60", "XC90"],
};

export type OpcaoModelo = { marca: string; modelo: string };

export type Catalogo = {
  marcas: string[];
  todosModelos: OpcaoModelo[];
  marcaConhecida: (marca: string) => string | null;
  /** Modelos da marca informada; sem marca conhecida, todos. */
  modelosSugeridos: (marca: string) => OpcaoModelo[];
  /** Marca do modelo, só quando o nome identifica uma única marca (evita chute em nomes repetidos). */
  marcaDoModelo: (modelo: string) => string | null;
};

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR");

export function criarCatalogo(mapa: Record<string, string[]>): Catalogo {
  const marcas = Object.keys(mapa).sort(ordenar);
  const todosModelos = marcas.flatMap((marca) => [...mapa[marca]].sort(ordenar).map((modelo) => ({ marca, modelo })));
  const marcaConhecida = (marca: string) => {
    const alvo = norm(marca);
    return marcas.find((m) => norm(m) === alvo) ?? null;
  };
  return {
    marcas,
    todosModelos,
    marcaConhecida,
    modelosSugeridos(marca) {
      const m = marcaConhecida(marca);
      return m ? todosModelos.filter((o) => o.marca === m) : todosModelos;
    },
    marcaDoModelo(modelo) {
      const alvo = norm(modelo);
      if (!alvo) return null;
      const achados = todosModelos.filter((o) => norm(o.modelo) === alvo);
      return achados.length === 1 ? achados[0].marca : null;
    },
  };
}

/** Reserva para quando a API do catálogo não responde. */
export const CATALOGO_LOCAL = criarCatalogo(CATALOGO_VEICULOS);

let cache: Promise<Catalogo> | null = null;

/** Catálogo completo vindo do backend (uma busca por sessão); em falha, usa a lista local. */
export function carregarCatalogo(): Promise<Catalogo> {
  cache ??= api
    .get<Record<string, string[]>>("/veiculos/catalogo")
    .then(({ data }) => (Object.keys(data ?? {}).length ? criarCatalogo(data) : CATALOGO_LOCAL))
    .catch(() => {
      cache = null; // tenta de novo na próxima abertura
      return CATALOGO_LOCAL;
    });
  return cache;
}

export function useCatalogo(): Catalogo {
  const [catalogo, setCatalogo] = React.useState<Catalogo>(CATALOGO_LOCAL);
  React.useEffect(() => {
    let ativo = true;
    carregarCatalogo().then((c) => ativo && setCatalogo(c));
    return () => {
      ativo = false;
    };
  }, []);
  return catalogo;
}

export const CORES_VEICULO: { nome: string; hex: string }[] = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Prata", hex: "#c0c4c9" },
  { nome: "Cinza", hex: "#6b7280" },
  { nome: "Preto", hex: "#111827" },
  { nome: "Vermelho", hex: "#dc2626" },
  { nome: "Vinho", hex: "#7f1d1d" },
  { nome: "Laranja", hex: "#f97316" },
  { nome: "Amarelo", hex: "#facc15" },
  { nome: "Verde", hex: "#16a34a" },
  { nome: "Azul", hex: "#2563eb" },
  { nome: "Bege", hex: "#d6c3a1" },
  { nome: "Marrom", hex: "#78350f" },
];
