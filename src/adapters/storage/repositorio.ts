/**
 * Persistência: revisões imutáveis + um único ponteiro remoto condicionado.
 *
 * Protocolo da secção 16.2, passo a passo:
 *  1. ler o ponteiro (`description`) e o `eTag` de `state-head`; carregar a
 *     revisão e validar hash, schema e workspace;
 *  2. verificar `operationId`: havendo recibo, devolver o resultado conhecido
 *     sem repetir a operação;
 *  3. aplicar a mutação sobre a revisão-base em memória e validar invariantes;
 *  4. gravar uma revisão nova em nome único, sem substituir nenhuma existente,
 *     e reler os bytes conferindo o SHA-256 — concluir o upload não publica;
 *  5. publicar com `PATCH` enviando só a nova descrição e `If-Match`;
 *  6. no 412, recarregar e reconciliar, sem insistir cegamente;
 *  7. confirmar que a revisão ativa (ou uma descendente) contém o recibo antes
 *     de dizer "Salvo no OneDrive".
 *
 * A combinação `description` + `eTag` + `If-Match` como protocolo de commit é
 * decisão deste projeto, não um recurso transacional anunciado pela Microsoft.
 * Enquanto a prova técnica da secção 16.5 não rodar na conta real, a integração
 * permanece não confirmada.
 */

import {
  SCHEMA_VERSION,
  type OperationReceipt,
  type Revision,
  type RevisionPointer,
  type Uuid,
} from '../../domain/entities/tipos';
import { lerPonteiro, serializarPonteiro, validarInvariantes } from '../../domain/entities/revisao';
import { ErroGraph, sha256Hex, type ClienteGraph, type ItemDrive } from '../graph/cliente';

export const PASTAS = {
  head: 'state-head',
  revisoes: 'revisions',
  fontes: 'sources',
  candidatos: 'candidates',
  exportacoes: 'exports',
  recuperacao: 'recovery',
} as const;

export interface EstruturaRemota {
  approotId: string;
  headId: string;
  revisoesId: string;
  fontesId: string;
  candidatosId: string;
  exportacoesId: string;
  recuperacaoId: string;
}

export type ResultadoSalvar =
  | { estado: 'confirmado'; revisao: Revision; recibo: OperationReceipt }
  | { estado: 'ja_aplicado'; revisao: Revision; recibo: OperationReceipt }
  | { estado: 'conflito'; revisaoAtual: Revision; detalhe: string }
  | { estado: 'incerto'; detalhe: string }
  | { estado: 'invalido'; problemas: string[] }
  | { estado: 'nao_autorizado' | 'quota' | 'erro'; detalhe: string };

export class BaseCorrompida extends Error {}
export class RecuperacaoNecessaria extends Error {
  constructor(
    message: string,
    readonly revisoesEncontradas: number,
  ) {
    super(message);
  }
}

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

export class RepositorioOneDrive {
  private estrutura: EstruturaRemota | null = null;

  constructor(
    private readonly graph: ClienteGraph,
    /** Identidade da conta ativa. Uma segunda conta nunca lê esta base. */
    private readonly contaHomeId: string,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Inicialização                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Cria ou abre a estrutura de pastas. Operação explícita (secção 16.3).
   * A disputa por criação é tratada como leitura da pasta existente — nunca
   * como `rename`, que produziria bases paralelas.
   */
  async inicializar(): Promise<EstruturaRemota> {
    const approot = await this.graph.approot();

    const obterOuCriar = async (nome: string): Promise<ItemDrive> => {
      try {
        return await this.graph.criarPasta(approot.id, nome);
      } catch (e) {
        if (e instanceof ErroGraph && e.codigo === 'conflito') {
          // Outra máquina criou primeiro: usamos a que existe.
          const filhos = await this.graph.filhos(approot.id);
          const achada = filhos.find((f) => f.nome === nome && f.pasta);
          if (achada) return achada;
        }
        throw e;
      }
    };

    const head = await obterOuCriar(PASTAS.head);
    const revisoes = await obterOuCriar(PASTAS.revisoes);
    const fontes = await obterOuCriar(PASTAS.fontes);
    const candidatos = await obterOuCriar(PASTAS.candidatos);
    const exportacoes = await obterOuCriar(PASTAS.exportacoes);
    const recuperacao = await obterOuCriar(PASTAS.recuperacao);

    this.estrutura = {
      approotId: approot.id,
      headId: head.id,
      revisoesId: revisoes.id,
      fontesId: fontes.id,
      candidatosId: candidatos.id,
      exportacoesId: exportacoes.id,
      recuperacaoId: recuperacao.id,
    };
    return this.estrutura;
  }

  private exigirEstrutura(): EstruturaRemota {
    if (!this.estrutura) throw new Error('A estrutura remota ainda não foi inicializada.');
    return this.estrutura;
  }

  /* ---------------------------------------------------------------- */
  /* Passo 1 — ler o ponteiro e a revisão ativa                        */
  /* ---------------------------------------------------------------- */

  async lerCabeca(): Promise<{ item: ItemDrive; ponteiro: RevisionPointer | null }> {
    const { headId } = this.exigirEstrutura();
    const item = await this.graph.obterItem(headId);
    return { item, ponteiro: lerPonteiro(item.descricao) };
  }

  /**
   * Carrega a revisão ativa. Valida hash, schema e workspace: um documento que
   * não confere é base corrompida, não uma base vazia.
   */
  async carregarRevisaoAtiva(): Promise<{ revisao: Revision | null; item: ItemDrive; ponteiro: RevisionPointer | null }> {
    const { item, ponteiro } = await this.lerCabeca();

    if (!ponteiro) {
      // Cabeça vazia com revisões já existentes é recuperação, nunca permissão
      // para zerar a base (secção 16.3).
      const { revisoesId } = this.exigirEstrutura();
      const existentes = (await this.graph.filhos(revisoesId)).filter((f) => !f.pasta);
      if (existentes.length > 0) {
        throw new RecuperacaoNecessaria(
          `O ponteiro está vazio, mas há ${existentes.length} revisão(ões) gravada(s). ` +
            'A base não pode ser recriada do zero: entre em recuperação.',
          existentes.length,
        );
      }
      return { revisao: null, item, ponteiro: null };
    }

    const bytes = await this.graph.baixarConteudo(ponteiro.itemId);
    const hash = await sha256Hex(bytes);
    if (hash !== ponteiro.sha256) {
      throw new BaseCorrompida(
        'O conteúdo da revisão ativa não corresponde ao hash registrado no ponteiro. A base não será usada neste estado.',
      );
    }

    const revisao = JSON.parse(decodificador.decode(bytes)) as Revision;

    if (revisao.schemaVersion !== SCHEMA_VERSION) {
      throw new BaseCorrompida(`A revisão usa a versão de schema ${revisao.schemaVersion}, incompatível com esta versão do aplicativo.`);
    }
    if (revisao.revisionId !== ponteiro.revisionId || revisao.workspaceId !== ponteiro.workspaceId) {
      throw new BaseCorrompida('A revisão apontada não corresponde ao ponteiro.');
    }
    // Uma segunda conta nunca carrega a base da primeira (AC-057).
    if (revisao.workspace.contaHomeId !== null && revisao.workspace.contaHomeId !== this.contaHomeId) {
      throw new BaseCorrompida('Esta base pertence a outra conta Microsoft e não será aberta com a conta atual.');
    }

    return { revisao, item, ponteiro };
  }

  /* ---------------------------------------------------------------- */
  /* Passo 2 — idempotência                                            */
  /* ---------------------------------------------------------------- */

  private reciboDe(revisao: Revision | null, operationId: string): OperationReceipt | null {
    return revisao?.receipts.find((r) => r.operationId === operationId) ?? null;
  }

  /* ---------------------------------------------------------------- */
  /* Passos 3 a 7 — aplicar e publicar                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Publica uma mutação. `mutar` recebe a revisão-base e devolve a nova
   * revisão (já com `revisionId` e `parentRevisionId` próprios) ou `null` para
   * abortar sem gravar nada.
   */
  async salvar(
    operationId: string,
    operacao: string,
    mutar: (base: Revision) => Revision | null,
  ): Promise<ResultadoSalvar> {
    const { revisoesId } = this.exigirEstrutura();

    let base: Revision | null;
    let itemCabeca: ItemDrive;
    try {
      const carregado = await this.carregarRevisaoAtiva();
      base = carregado.revisao;
      itemCabeca = carregado.item;
    } catch (e) {
      if (e instanceof ErroGraph) return this.traduzirErro(e);
      throw e;
    }

    if (base === null) {
      return { estado: 'erro', detalhe: 'Não há base ativa. Inicialize a base antes de gravar.' };
    }

    // Passo 2: a operação já pode ter sido confirmada.
    const reciboExistente = this.reciboDe(base, operationId);
    if (reciboExistente) return { estado: 'ja_aplicado', revisao: base, recibo: reciboExistente };

    // Passo 3: aplicar em memória e validar invariantes.
    const nova = mutar(base);
    if (nova === null) return { estado: 'erro', detalhe: 'A operação foi abortada antes de gravar.' };

    const recibo: OperationReceipt = {
      operationId,
      operacao,
      resultado: 'confirmado',
      revisaoPublicada: nova.revisionId,
      em: new Date().toISOString(),
    };
    nova.receipts = [...nova.receipts, recibo];
    nova.workspace = { ...nova.workspace, contaHomeId: this.contaHomeId };

    const problemas = validarInvariantes(nova);
    if (problemas.length > 0) {
      return { estado: 'invalido', problemas: problemas.map((p) => `${p.codigo}: ${p.detalhe}`) };
    }

    // Passo 4: gravar em nome único e conferir os bytes gravados.
    const bytes = codificador.encode(JSON.stringify(nova));
    const hashEsperado = await sha256Hex(bytes);
    const nome = `rev-${nova.criadoEm.replace(/[:.]/g, '-')}-${nova.revisionId}.json`;

    let itemRevisao: ItemDrive;
    try {
      itemRevisao = await this.graph.enviarConteudo(revisoesId, nome, bytes);
      const relidos = await this.graph.baixarConteudo(itemRevisao.id);
      const hashRelido = await sha256Hex(relidos);
      if (hashRelido !== hashEsperado) {
        // Upload concluído não publica estado: o ponteiro nem é tocado.
        return { estado: 'erro', detalhe: 'Os bytes gravados não conferem com o que foi enviado. A revisão anterior continua ativa.' };
      }
    } catch (e) {
      if (e instanceof ErroGraph) return this.traduzirErro(e);
      throw e;
    }

    // Passo 5: publicar o ponteiro com If-Match.
    const ponteiro: RevisionPointer = {
      version: 1,
      workspaceId: nova.workspaceId,
      revisionId: nova.revisionId,
      itemId: itemRevisao.id,
      sha256: hashEsperado,
    };

    let descricao: string;
    try {
      descricao = serializarPonteiro(ponteiro);
    } catch (e) {
      return { estado: 'erro', detalhe: (e as Error).message };
    }

    try {
      await this.graph.atualizarDescricao(itemCabeca.id, descricao, itemCabeca.eTag);
    } catch (e) {
      if (e instanceof ErroGraph && e.codigo === 'precondicao_falhou') {
        // Passo 6: outra operação venceu. Não insistir cegamente.
        const atual = await this.carregarRevisaoAtiva();
        return {
          estado: 'conflito',
          revisaoAtual: atual.revisao!,
          detalhe:
            'Outra sessão publicou primeiro. A sua revisão foi gravada e continua identificável, mas não entrou na base. ' +
            'As duas alterações precisam ser conciliadas.',
        };
      }
      if (e instanceof ErroGraph && e.codigo === 'incerto') {
        // Passo 7 na variante de resposta perdida (secção 16.3): consultar, não repetir.
        const confirmado = await this.confirmarPorRecibo(operationId);
        return confirmado
          ? { estado: 'confirmado', revisao: nova, recibo }
          : {
              estado: 'incerto',
              detalhe: 'A confirmação do servidor não chegou. A operação pode ter sido gravada; verifique antes de repetir.',
            };
      }
      if (e instanceof ErroGraph) return this.traduzirErro(e);
      throw e;
    }

    // Passo 7: só agora é legítimo dizer "Salvo no OneDrive".
    const confirmado = await this.confirmarPorRecibo(operationId);
    if (!confirmado) {
      return { estado: 'incerto', detalhe: 'A publicação não pôde ser confirmada pela leitura do recibo.' };
    }
    return { estado: 'confirmado', revisao: nova, recibo };
  }

  /**
   * Verifica se a revisão ativa contém o recibo da operação.
   * Uma operação posterior legítima não invalida o recibo anterior: por isso a
   * checagem é pela presença do recibo, não pela igualdade do `revisionId`.
   */
  async confirmarPorRecibo(operationId: string): Promise<boolean> {
    try {
      const { revisao } = await this.carregarRevisaoAtiva();
      return this.reciboDe(revisao, operationId) !== null;
    } catch {
      return false;
    }
  }

  /** Publica a primeira revisão de uma base nova. */
  async publicarRevisaoInicial(revisao: Revision, operationId: string): Promise<ResultadoSalvar> {
    const { revisoesId } = this.exigirEstrutura();
    const { item, ponteiro } = await this.lerCabeca();

    if (ponteiro) {
      // Outra máquina já inicializou: usamos a base existente (AC-064).
      const atual = await this.carregarRevisaoAtiva();
      return {
        estado: 'conflito',
        revisaoAtual: atual.revisao!,
        detalhe: 'A base já havia sido inicializada nesta conta. A base existente foi aberta, sem criar uma segunda.',
      };
    }

    const comConta: Revision = {
      ...revisao,
      workspace: { ...revisao.workspace, contaHomeId: this.contaHomeId },
      receipts: [
        ...revisao.receipts,
        { operationId, operacao: 'inicializar', resultado: 'confirmado', revisaoPublicada: revisao.revisionId, em: new Date().toISOString() },
      ],
    };

    const bytes = codificador.encode(JSON.stringify(comConta));
    const hash = await sha256Hex(bytes);
    const nome = `rev-${comConta.criadoEm.replace(/[:.]/g, '-')}-${comConta.revisionId}.json`;

    try {
      const itemRevisao = await this.graph.enviarConteudo(revisoesId, nome, bytes);
      await this.graph.atualizarDescricao(
        item.id,
        serializarPonteiro({ version: 1, workspaceId: comConta.workspaceId, revisionId: comConta.revisionId, itemId: itemRevisao.id, sha256: hash }),
        item.eTag,
      );
    } catch (e) {
      if (e instanceof ErroGraph && e.codigo === 'precondicao_falhou') {
        const atual = await this.carregarRevisaoAtiva();
        return {
          estado: 'conflito',
          revisaoAtual: atual.revisao!,
          detalhe: 'Outra sessão inicializou a base ao mesmo tempo. A base existente foi aberta; nenhuma base paralela foi criada.',
        };
      }
      if (e instanceof ErroGraph) return this.traduzirErro(e);
      throw e;
    }

    return {
      estado: 'confirmado',
      revisao: comConta,
      recibo: comConta.receipts[comConta.receipts.length - 1]!,
    };
  }

  /**
   * Restaurar é criar uma revisão **nova** a partir de um checkpoint,
   * preservando a anterior para retorno (secção 17).
   */
  async restaurar(revisaoCheckpoint: Revision, operationId: string): Promise<ResultadoSalvar> {
    return this.salvar(operationId, 'restoreWorkspace', (base) => ({
      ...revisaoCheckpoint,
      revisionId: globalThis.crypto.randomUUID(),
      parentRevisionId: base.revisionId,
      criadoEm: new Date().toISOString(),
      // A história anterior continua acessível: as revisões não são apagadas.
      audit: [
        ...base.audit,
        {
          id: globalThis.crypto.randomUUID(),
          operationId,
          operacao: 'restoreWorkspace',
          antes: { revisionId: base.revisionId },
          depois: { restauradaDe: revisaoCheckpoint.revisionId },
          revisaoBase: base.revisionId,
          autoria: 'pessoa',
          horarioTecnico: new Date().toISOString(),
        },
      ],
      receipts: base.receipts,
    }));
  }

  async listarRevisoes(): Promise<ItemDrive[]> {
    const { revisoesId } = this.exigirEstrutura();
    return (await this.graph.filhos(revisoesId)).filter((f) => !f.pasta);
  }

  private traduzirErro(e: ErroGraph): ResultadoSalvar {
    switch (e.codigo) {
      case 'nao_autorizado':
        return { estado: 'nao_autorizado', detalhe: 'A sessão expirou. Entre novamente para continuar.' };
      case 'proibido':
        return { estado: 'erro', detalhe: 'A conta não tem permissão para esta operação. A permissão não será ampliada automaticamente.' };
      case 'quota':
        // Cota insuficiente não é salvamento (AC-066).
        return { estado: 'quota', detalhe: 'Não há espaço suficiente na conta. Nada foi salvo.' };
      case 'limite_taxa':
        return {
          estado: 'erro',
          detalhe: `O serviço pediu para aguardar${e.retryAfterSegundos ? ` ${e.retryAfterSegundos} s` : ''} antes de tentar de novo. Nada foi salvo.`,
        };
      case 'incerto':
        return { estado: 'incerto', detalhe: 'A confirmação do servidor não chegou. Verifique antes de repetir a operação.' };
      case 'nao_encontrado':
        return { estado: 'erro', detalhe: 'O arquivo esperado não foi encontrado. Reveja o vínculo ou use a recuperação.' };
      default:
        return { estado: 'erro', detalhe: `${e.message} Nada foi salvo.` };
    }
  }
}

export type { Uuid };
