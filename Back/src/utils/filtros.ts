/** "a,b" -> ["a","b"], sem vazios. */
export function listaCsv(valor?: string) {
  return (valor ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

/** YYYY-MM-DD em Date UTC à meia-noite (como as datas sem hora são gravadas); qualquer outra coisa vira undefined. */
export function dataIso(valor?: string) {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00:00.000Z`) : undefined;
}
