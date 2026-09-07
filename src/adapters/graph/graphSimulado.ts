/**
 * Graph simulado, em memória, para os testes do protocolo de commit.
 *
 * Reproduz o que o protocolo depende: identidade de item, eTag que muda a cada
 * gravação, `If-Match` no PATCH de propriedades e `conflictBehavior: fail` na
 * criação de pastas.
 *
 * **Isto não é o Microsoft Graph.** Passar nestes testes prova que o protocolo
 * é correto sob concorrência; não prova que o OneDrive real se comporta assim.
 * A prova técnica bloqueante da secção 16.5 exige execução na conta real.
 */

import { ErroGraph, type ClienteGraph, type ItemDrive } from './cliente';

interface No {
  id: string;
  nome: string;
  paiId: string | null;
  pasta: boolean;
  descricao: string;
  conteudo: Uint8Array | null;
  versaoMetadados: number;
  versaoConteudo: number;
}

export interface FalhasSimuladas {
  /** Faz o próximo PATCH aplicar a mudança e depois falhar como resposta perdida. */
  perderRespostaDoProximoPatch?: boolean;
  /** Faz o próximo envio de conteúdo falhar antes de gravar. */
  falharProximoEnvio?: boolean;
  /** Devolve este erro no próximo obterItem. */
  erroNoProximoObterItem?: ErroGraph;
  /** Simula cota insuficiente no próximo envio. */
  quotaNoProximoEnvio?: boolean;
}

export class GraphSimulado implements ClienteGraph {
  private readonly nos = new Map<string, No>();
  private sequencia = 0;
  readonly falhas: FalhasSimuladas = {};
  /** Contadores para as asserções dos testes. */
  readonly chamadas = { patch: 0, envio: 0, download: 0, criarPasta: 0 };

  constructor(readonly conta = 'conta-a') {
    this.nos.set('approot', {
      id: 'approot',
      nome: 'Central de Chamados',
      paiId: null,
      pasta: true,
      descricao: '',
      conteudo: null,
      versaoMetadados: 1,
      versaoConteudo: 1,
    });
  }

  private novoId(): string {
    this.sequencia += 1;
    return `item-${this.conta}-${this.sequencia}`;
  }

  private paraItem(n: No): ItemDrive {
    return {
      id: n.id,
      nome: n.nome,
      eTag: `"${n.id}-m${n.versaoMetadados}"`,
      cTag: `"${n.id}-c${n.versaoConteudo}"`,
      descricao: n.descricao,
      tamanho: n.conteudo?.length ?? 0,
      pasta: n.pasta,
      downloadUrl: n.pasta ? undefined : `https://simulado.invalid/${n.id}?temp=1`,
    };
  }

  private exigir(id: string): No {
    const n = this.nos.get(id);
    if (!n) throw new ErroGraph(`O item ${id} não existe mais.`, 'nao_encontrado', 404);
    return n;
  }

  async approot(): Promise<ItemDrive> {
    return this.paraItem(this.exigir('approot'));
  }

  async filhos(pastaId: string): Promise<ItemDrive[]> {
    this.exigir(pastaId);
    return [...this.nos.values()].filter((n) => n.paiId === pastaId).map((n) => this.paraItem(n));
  }

  async criarPasta(paiId: string, nome: string): Promise<ItemDrive> {
    this.chamadas.criarPasta += 1;
    this.exigir(paiId);
    const existente = [...this.nos.values()].find((n) => n.paiId === paiId && n.nome === nome);
    // conflictBehavior: fail — o chamador trata o conflito lendo a pasta existente.
    if (existente) throw new ErroGraph(`A pasta "${nome}" já existe.`, 'conflito', 409);

    const no: No = {
      id: this.novoId(),
      nome,
      paiId,
      pasta: true,
      descricao: '',
      conteudo: null,
      versaoMetadados: 1,
      versaoConteudo: 1,
    };
    this.nos.set(no.id, no);
    return this.paraItem(no);
  }

  async obterItem(itemId: string): Promise<ItemDrive> {
    if (this.falhas.erroNoProximoObterItem) {
      const erro = this.falhas.erroNoProximoObterItem;
      this.falhas.erroNoProximoObterItem = undefined;
      throw erro;
    }
    return this.paraItem(this.exigir(itemId));
  }

  async enviarConteudo(paiId: string, nome: string, bytes: Uint8Array): Promise<ItemDrive> {
    this.chamadas.envio += 1;
    this.exigir(paiId);

    if (this.falhas.quotaNoProximoEnvio) {
      this.falhas.quotaNoProximoEnvio = false;
      throw new ErroGraph('Não há espaço suficiente na conta.', 'quota', 507);
    }
    if (this.falhas.falharProximoEnvio) {
      this.falhas.falharProximoEnvio = false;
      throw new ErroGraph('A conexão caiu durante o envio.', 'transporte');
    }

    const existente = [...this.nos.values()].find((n) => n.paiId === paiId && n.nome === nome);
    // Revisões são imutáveis: um nome já usado é erro, não substituição.
    if (existente) throw new ErroGraph(`O arquivo "${nome}" já existe.`, 'conflito', 409);

    const no: No = {
      id: this.novoId(),
      nome,
      paiId,
      pasta: false,
      descricao: '',
      conteudo: bytes.slice(),
      versaoMetadados: 1,
      versaoConteudo: 1,
    };
    this.nos.set(no.id, no);
    return this.paraItem(no);
  }

  async baixarConteudo(itemId: string): Promise<Uint8Array> {
    this.chamadas.download += 1;
    const n = this.exigir(itemId);
    if (!n.conteudo) throw new ErroGraph('O item não tem conteúdo.', 'nao_encontrado', 404);
    return n.conteudo.slice();
  }

  async atualizarDescricao(itemId: string, descricao: string, ifMatch: string): Promise<ItemDrive> {
    this.chamadas.patch += 1;
    const n = this.exigir(itemId);
    const atual = `"${n.id}-m${n.versaoMetadados}"`;

    if (!ifMatch) throw new ErroGraph('PATCH sem If-Match não é permitido por este protocolo.', 'precondicao_falhou', 428);
    if (ifMatch !== atual) {
      throw new ErroGraph('Outra operação publicou primeiro.', 'precondicao_falhou', 412);
    }

    n.descricao = descricao;
    n.versaoMetadados += 1;

    if (this.falhas.perderRespostaDoProximoPatch) {
      // A gravação aconteceu, mas o chamador não recebe a confirmação.
      this.falhas.perderRespostaDoProximoPatch = false;
      throw new ErroGraph('A resposta do servidor não chegou.', 'incerto');
    }
    return this.paraItem(n);
  }

  /* ---- utilidades de teste ---- */

  /** Altera um item por fora, como o dono da conta faria (secção 17). */
  alterarPorFora(itemId: string, conteudo: Uint8Array): void {
    const n = this.exigir(itemId);
    n.conteudo = conteudo.slice();
    n.versaoConteudo += 1;
  }

  removerPorFora(itemId: string): void {
    this.nos.delete(itemId);
  }

  contarArquivos(paiId: string): number {
    return [...this.nos.values()].filter((n) => n.paiId === paiId && !n.pasta).length;
  }
}
