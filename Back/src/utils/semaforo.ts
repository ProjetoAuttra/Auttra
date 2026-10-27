/** Limita quantas tarefas assíncronas rodam ao mesmo tempo; as demais esperam na fila, em ordem de chegada. */
export class Semaforo {
  private livres: number;
  private fila: Array<() => void> = [];

  constructor(limite: number) {
    this.livres = Math.max(1, Math.floor(limite));
  }

  async executar<T>(tarefa: () => Promise<T>): Promise<T> {
    await this.adquirir();
    try {
      return await tarefa();
    } finally {
      this.liberar();
    }
  }

  private adquirir() {
    if (this.livres > 0) {
      this.livres--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.fila.push(resolve));
  }

  private liberar() {
    const proximo = this.fila.shift();
    if (proximo) proximo();
    else this.livres++;
  }
}
