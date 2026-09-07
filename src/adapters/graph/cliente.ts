/**
 * Porta do Microsoft Graph usada pela persistência.
 *
 * A interface é mínima de propósito: só as operações que o protocolo de
 * revisões precisa. Existem duas implementações — a real (`graphReal.ts`,
 * sobre `fetch` + MSAL) e a simulada (`graphSimulado.ts`, usada nos testes de
 * concorrência). O protocolo é o mesmo nas duas.
 */

export type CodigoErroGraph =
  | 'nao_autorizado' // 401 — reautenticar
  | 'proibido' // 403 — explicar a permissão, sem ampliá-la
  | 'nao_encontrado' // 404 — rever vínculo ou recuperar
  | 'conflito' // 409 — nome já existe
  | 'precondicao_falhou' // 412 — outra operação venceu
  | 'quota' // 507 — cota insuficiente NÃO é salvamento
  | 'limite_taxa' // 429 — respeitar Retry-After
  | 'servidor' // 5xx — retentativa limitada
  | 'transporte' // rede caiu: um erro de transporte não é sucesso
  | 'incerto'; // resposta perdida: o resultado precisa ser consultado

export class ErroGraph extends Error {
  constructor(
    message: string,
    readonly codigo: CodigoErroGraph,
    readonly status?: number,
    readonly retryAfterSegundos?: number,
  ) {
    super(message);
    this.name = 'ErroGraph';
  }
}

export interface ItemDrive {
  id: string;
  nome: string;
  /** eTag de metadados; usado como condição no PATCH do ponteiro. */
  eTag: string;
  /** cTag muda com o conteúdo; usado para detectar troca de arquivo. */
  cTag?: string;
  descricao?: string;
  tamanho?: number;
  pasta: boolean;
  /** URL temporária de download. Nunca guardada em estado, log ou repositório. */
  downloadUrl?: string;
}

export interface ClienteGraph {
  /** `GET /me/drive/special/approot` — nunca um ID fixo de outra conta. */
  approot(): Promise<ItemDrive>;

  filhos(pastaId: string): Promise<ItemDrive[]>;

  /**
   * Cria pasta com `@microsoft.graph.conflictBehavior: fail`.
   * Nunca `rename`: duas máquinas inicializando ao mesmo tempo não podem
   * produzir bases paralelas (secção 16.3).
   */
  criarPasta(paiId: string, nome: string): Promise<ItemDrive>;

  obterItem(itemId: string): Promise<ItemDrive>;

  /** Envia conteúdo com nome único. Nunca substitui uma revisão existente. */
  enviarConteudo(paiId: string, nome: string, bytes: Uint8Array): Promise<ItemDrive>;

  /**
   * Lê os bytes. No navegador, obtém `@microsoft.graph.downloadUrl` dos
   * metadados e usa a URL temporária **sem** anexar o bearer token a ela.
   */
  baixarConteudo(itemId: string): Promise<Uint8Array>;

  /**
   * `PATCH /me/drive/items/{id}` enviando apenas `description`, com `If-Match`.
   * Um PATCH sem condição não é permitido por este contrato.
   * Lança `ErroGraph('precondicao_falhou')` no 412.
   */
  atualizarDescricao(itemId: string, descricao: string, ifMatch: string): Promise<ItemDrive>;
}

/** SHA-256 em hexadecimal, calculado sobre os bytes obtidos. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
