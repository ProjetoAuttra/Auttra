import { describe, expect, it } from "vitest";
import {
  escreverDiasAtendimento,
  escreverFormasPagamento,
  escreverMinutos,
  escreverPercentual,
  lerDiasAtendimento,
  lerFormasPagamento,
  lerMinutos,
  lerPercentual,
} from "../modules/configuracoes/utils/formatosConfig";

describe("dias de atendimento", () => {
  it.each([
    ["Segunda a Sábado", [0, 1, 2, 3, 4, 5]],
    ["segunda-feira a sexta-feira", [0, 1, 2, 3, 4]],
    ["Seg, Qua e Sex", [0, 2, 4]],
    ["Segunda a Sexta e Sábado", [0, 1, 2, 3, 4, 5]],
    ["Todos os dias", [0, 1, 2, 3, 4, 5, 6]],
    ["Sábado a Segunda", [0, 5, 6]],
  ])("lê %s", (texto, dias) => {
    expect(lerDiasAtendimento(texto)).toEqual(dias);
  });

  it.each(["", "Plantão no feriado", "Segundo turno"])("não reconhece %j", (texto) => {
    expect(lerDiasAtendimento(texto)).toBeNull();
  });

  it.each([
    [[0, 1, 2, 3, 4, 5], "Segunda a Sábado"],
    [[0, 2, 4], "Segunda, Quarta e Sexta"],
    [[5, 6], "Sábado e Domingo"],
    [[0, 1, 2, 3, 4, 6], "Segunda a Sexta e Domingo"],
    [[0, 1, 2, 3, 4, 5, 6], "Todos os dias"],
    [[], ""],
  ])("escreve %j", (dias, texto) => {
    expect(escreverDiasAtendimento(dias)).toBe(texto);
    if (texto) expect(lerDiasAtendimento(texto)).toEqual(dias);
  });
});

describe("tempo médio", () => {
  it.each([
    ["60 minutos", 60],
    ["45 min", 45],
    ["90", 90],
    ["1 hora", 60],
    ["1h30", 90],
    ["1 hora e 30 minutos", 90],
  ])("lê %s", (texto, minutos) => {
    expect(lerMinutos(texto)).toBe(minutos);
  });

  it("não reconhece texto livre", () => {
    expect(lerMinutos("depende do serviço")).toBeNull();
    expect(lerMinutos("")).toBeNull();
  });

  it("escreve em minutos", () => {
    expect(escreverMinutos(60)).toBe("60 minutos");
    expect(escreverMinutos(1)).toBe("1 minuto");
  });
});

describe("juros e formas de pagamento", () => {
  it("lê e escreve o percentual com vírgula", () => {
    expect(lerPercentual("2%")).toBe(2);
    expect(lerPercentual("2,5 %")).toBe(2.5);
    expect(lerPercentual("2% ao mês")).toBeNull();
    expect(escreverPercentual(2.5)).toBe("2,5%");
  });

  it("separa e junta as formas de pagamento", () => {
    expect(lerFormasPagamento("Pix, Cartão,  Dinheiro")).toEqual(["Pix", "Cartão", "Dinheiro"]);
    expect(lerFormasPagamento("")).toEqual([]);
    expect(escreverFormasPagamento(["Pix", " Boleto "])).toBe("Pix, Boleto");
  });
});
