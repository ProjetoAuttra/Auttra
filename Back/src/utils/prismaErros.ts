/**
 * Texto que identifica o que bateu numa violacao de unique (P2002), para escolher a mensagem.
 * Prisma 6 trazia os campos em `meta.target`; no Prisma 7 (driver adapter) vem o nome da
 * constraint/indice em `meta.driverAdapterError.cause.constraint` (ex.: "oficina_cnpj_key").
 */
export function alvoUnicoViolado(err: any): string {
  const meta = err?.meta ?? {};
  const constraint = meta.driverAdapterError?.cause?.constraint ?? {};
  return [meta.target, constraint.index, constraint.fields]
    .flat()
    .filter((parte) => parte != null)
    .map(String)
    .join(" ");
}
