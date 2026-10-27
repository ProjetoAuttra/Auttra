import { describe, expect, it } from "vitest";
import { Semaforo } from "../src/utils/semaforo.js";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Semaforo", () => {
  it("nunca roda mais tarefas simultâneas que o limite", async () => {
    const sem = new Semaforo(2);
    let ativas = 0;
    let pico = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        sem.executar(async () => {
          ativas++;
          pico = Math.max(pico, ativas);
          await esperar(10);
          ativas--;
        })
      )
    );
    expect(pico).toBe(2);
  });

  it("libera a vaga quando a tarefa falha e mantém a ordem de chegada", async () => {
    const sem = new Semaforo(1);
    const ordem: number[] = [];
    const falha = sem.executar(async () => {
      await esperar(5);
      throw new Error("x");
    });
    const a = sem.executar(async () => void ordem.push(1));
    const b = sem.executar(async () => void ordem.push(2));
    await expect(falha).rejects.toThrow("x");
    await Promise.all([a, b]);
    expect(ordem).toEqual([1, 2]);
  });
});
