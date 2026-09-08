import { describe, expect, it, beforeEach } from 'vitest';
import { GraphSimulado } from '../src/adapters/graph/graphSimulado';
import { ErroGraph } from '../src/adapters/graph/cliente';
import { BaseCorrompida, RecuperacaoNecessaria, RepositorioOneDrive } from '../src/adapters/storage/repositorio';
import { novoWorkspace, revisaoInicial, lerPonteiro, serializarPonteiro } from '../src/domain/entities/revisao';
import { LIMITE_PONTEIRO_CARACTERES, type Revision } from '../src/domain/entities/tipos';
import { apontamento } from './apoio/construtores';

/**
 * IMPORTANTE: estes testes rodam contra um Graph **simulado**. Passar aqui
 * prova que o protocolo de commit é correto sob concorrência. Não prova que o
 * OneDrive real se comporta assim — a prova técnica da secção 16.5 exige
 * execução na conta Microsoft real e ainda não foi feita.
 */

async function baseInicializada(graph = new GraphSimulado(), conta = 'conta-a') {
  const repo = new RepositorioOneDrive(graph, conta);
  await repo.inicializar();
  const ws = novoWorkspace('Base de teste', '00000000-0000-4000-8000-000000000001');
  const inicial = revisaoInicial(ws);
  await repo.publicarRevisaoInicial(inicial, 'op-init');
  return { graph, repo };
}

/** Mutação que acrescenta um apontamento de N minutos. */
function acrescentar(minutos: number, data = '2026-09-01') {
  return (base: Revision): Revision => ({
    ...base,
    revisionId: crypto.randomUUID(),
    parentRevisionId: base.revisionId,
    criadoEm: new Date().toISOString(),
    timeEntries: [
      ...base.timeEntries,
      apontamento({ workspaceId: base.workspaceId, workDate: data, duracaoMinutos: minutos }),
    ],
  });
}

describe('secção 16.3 — inicialização', () => {
  it('cria a estrutura de pastas com nomes fixos', async () => {
    const graph = new GraphSimulado();
    const repo = new RepositorioOneDrive(graph, 'conta-a');
    const e = await repo.inicializar();
    expect(e.headId).toBeTruthy();
    expect(e.revisoesId).toBeTruthy();
    const filhos = await graph.filhos(e.approotId);
    expect(filhos.map((f) => f.nome).sort()).toEqual(['candidates', 'exports', 'recovery', 'revisions', 'sources', 'state-head']);
  });

  it('AC-064: duas máquinas inicializando ao mesmo tempo não criam bases paralelas', async () => {
    const graph = new GraphSimulado();
    const repoA = new RepositorioOneDrive(graph, 'conta-a');
    const repoB = new RepositorioOneDrive(graph, 'conta-a');

    const [a, b] = await Promise.all([repoA.inicializar(), repoB.inicializar()]);
    // A disputa por criação vira leitura da pasta existente: mesma identidade.
    expect(a.headId).toBe(b.headId);
    expect(a.revisoesId).toBe(b.revisoesId);

    const filhos = await graph.filhos(a.approotId);
    expect(filhos.filter((f) => f.nome === 'state-head')).toHaveLength(1);
    // Nenhuma pasta renomeada do tipo "state-head 1".
    expect(filhos.some((f) => /state-head\s*\d/.test(f.nome))).toBe(false);
  });

  it('a segunda inicialização de base abre a existente, sem criar outra', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    const repo2 = new RepositorioOneDrive(graph, 'conta-a');
    await repo2.inicializar();
    const r = await repo2.publicarRevisaoInicial(revisaoInicial(novoWorkspace('Outra')), 'op-init-2');

    expect(r.estado).toBe('conflito');
    expect((r as { detalhe: string }).detalhe).toMatch(/já havia sido inicializada/i);
    expect(await repo.listarRevisoes()).toHaveLength(1);
  });

  it('AC-065: cabeça vazia com revisões existentes entra em recuperação, não zera a base', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    // Alguém limpou a descrição da pasta por fora.
    const { item } = await repo.lerCabeca();
    await graph.atualizarDescricao(item.id, '', item.eTag);

    await expect(repo.carregarRevisaoAtiva()).rejects.toBeInstanceOf(RecuperacaoNecessaria);
  });
});

describe('recuperarApontandoPara — recuperação manual (secção 16.3)', () => {
  it('aponta a base para a revisão escolhida quando o ponteiro está vazio', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    await repo.salvar('op-1', 'x', acrescentar(30));
    const revisaoOriginal = (await repo.carregarRevisaoAtiva()).revisao!;

    // Alguém limpou a descrição da pasta por fora — mesmo cenário do AC-065.
    const { item, ponteiro: ponteiroAntes } = await repo.lerCabeca();
    await graph.atualizarDescricao(item.id, '', item.eTag);
    await expect(repo.carregarRevisaoAtiva()).rejects.toBeInstanceOf(RecuperacaoNecessaria);

    const r = await repo.recuperarApontandoPara(ponteiroAntes!.itemId);
    expect(r.estado).toBe('confirmado');
    expect((r as { revisao: Revision }).revisao.revisionId).toBe(revisaoOriginal.revisionId);

    const { revisao: ativa } = await repo.carregarRevisaoAtiva();
    expect(ativa!.revisionId).toBe(revisaoOriginal.revisionId);
    expect(ativa!.timeEntries).toHaveLength(1);
  });

  it('recusa sobrescrever um ponteiro que já é válido', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    const { ponteiro } = await repo.lerCabeca();

    // O ponteiro nunca foi apagado desta vez.
    const r = await repo.recuperarApontandoPara(ponteiro!.itemId);
    expect(r.estado).toBe('conflito');
    expect((r as { detalhe: string }).detalhe).toMatch(/já tinha um ponteiro válido/i);
  });

  it('recusa recuperar uma revisão gravada por outra conta', async () => {
    const graph = new GraphSimulado();
    const { repo, graph: g } = await baseInicializada(graph, 'conta-a');
    const estrutura = await repo.inicializar();

    // Revisão "de outra conta", gravada diretamente no Graph (simula um
    // arquivo que acabou nessa pasta por engano ou má-fé).
    const base = revisaoInicial(novoWorkspace('Outra'));
    const deOutraConta: Revision = { ...base, workspace: { ...base.workspace, contaHomeId: 'conta-b' } };
    const bytes = new TextEncoder().encode(JSON.stringify(deOutraConta));
    const item = await g.enviarConteudo(estrutura.revisoesId, 'rev-outra-conta.json', bytes);

    const { item: cabeca } = await repo.lerCabeca();
    await g.atualizarDescricao(cabeca.id, '', cabeca.eTag);

    const r = await repo.recuperarApontandoPara(item.id);
    expect(r.estado).toBe('erro');
    expect((r as { detalhe: string }).detalhe).toMatch(/outra conta/i);
  });
});

describe('AC-061 — duas sessões disputando a publicação', () => {
  it('cem disputas a partir do mesmo eTag: um vencedor por base, nenhum recibo perdido', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    let vencedores = 0;
    let perdedores = 0;
    const perdidas: string[] = [];

    for (let i = 0; i < 100; i += 1) {
      const a = new RepositorioOneDrive(graph, 'conta-a');
      const b = new RepositorioOneDrive(graph, 'conta-a');
      await a.inicializar();
      await b.inicializar();

      // Datas distintas por rodada: o teste é de concorrência, não do teto
      // diário de 1.440 minutos (que tem cobertura própria).
      const data = `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;

      // As duas leem o mesmo eTag antes de qualquer publicação.
      const [r1, r2] = await Promise.all([
        a.salvar(`op-a-${i}`, 'createTimeEntry', acrescentar(30, data)),
        b.salvar(`op-b-${i}`, 'createTimeEntry', acrescentar(45, data)),
      ]);

      const confirmados = [r1, r2].filter((r) => r.estado === 'confirmado');
      const conflitos = [r1, r2].filter((r) => r.estado === 'conflito');

      // Exatamente um vencedor por rodada.
      expect(confirmados).toHaveLength(1);
      expect(conflitos).toHaveLength(1);
      vencedores += confirmados.length;
      perdedores += conflitos.length;

      // O perdedor recebe a revisão atual para conciliar; nada é aplicado por cima.
      const conflito = conflitos[0] as { revisaoAtual: Revision; detalhe: string };
      expect(conflito.revisaoAtual).toBeDefined();
      perdidas.push(r1.estado === 'conflito' ? `op-a-${i}` : `op-b-${i}`);
    }

    expect(vencedores).toBe(100);
    expect(perdedores).toBe(100);

    // Nenhum recibo do vencedor se perdeu ao longo das 100 rodadas.
    const { revisao } = await repo.carregarRevisaoAtiva();
    const recibos = new Set(revisao!.receipts.map((r) => r.operationId));
    for (let i = 0; i < 100; i += 1) {
      const perdida = perdidas[i]!;
      const vencedora = perdida.startsWith('op-a') ? `op-b-${i}` : `op-a-${i}`;
      expect(recibos.has(vencedora), `recibo de ${vencedora} deveria estar na base`).toBe(true);
    }
    expect(revisao!.timeEntries).toHaveLength(100);
  }, 60_000);

  it('a operação perdedora é reaplicável e as duas ficam preservadas depois da conciliação', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    const a = new RepositorioOneDrive(graph, 'conta-a');
    const b = new RepositorioOneDrive(graph, 'conta-a');
    await a.inicializar();
    await b.inicializar();

    const [r1, r2] = await Promise.all([
      a.salvar('op-a', 'createTimeEntry', acrescentar(30)),
      b.salvar('op-b', 'createTimeEntry', acrescentar(45)),
    ]);
    // r1 é o resultado de `a`: se `a` conflitou, o perdedor é `a`.
    const aPerdeu = r1.estado === 'conflito';
    const perdedor = aPerdeu ? a : b;
    const idPerdido = aPerdeu ? 'op-a' : 'op-b';
    const minutosPerdidos = aPerdeu ? 30 : 45;
    expect(r2.estado).toBe(aPerdeu ? 'confirmado' : 'conflito');

    // Adição independente pode ser reaplicada sobre a revisão vencedora.
    const rereaplicado = await perdedor.salvar(idPerdido, 'createTimeEntry', acrescentar(minutosPerdidos));
    expect(rereaplicado.estado).toBe('confirmado');

    const { revisao } = await repo.carregarRevisaoAtiva();
    expect(revisao!.timeEntries).toHaveLength(2);
    expect(revisao!.timeEntries.map((e) => e.duracaoMinutos).sort()).toEqual([30, 45]);
    expect(revisao!.receipts.filter((x) => x.operationId === 'op-a' || x.operationId === 'op-b')).toHaveLength(2);
  });

  it('a revisão do perdedor foi gravada e continua identificável, mas não entra na base', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    const estrutura = await repo.inicializar();

    const a = new RepositorioOneDrive(graph, 'conta-a');
    const b = new RepositorioOneDrive(graph, 'conta-a');
    await a.inicializar();
    await b.inicializar();
    await Promise.all([a.salvar('op-a', 'x', acrescentar(30)), b.salvar('op-b', 'x', acrescentar(45))]);

    // Três arquivos: inicial + duas revisões gravadas; só uma está publicada.
    expect(graph.contarArquivos(estrutura.revisoesId)).toBe(3);
    const { revisao } = await repo.carregarRevisaoAtiva();
    expect(revisao!.timeEntries).toHaveLength(1);
  });
});

describe('AC-063 — resposta perdida e idempotência', () => {
  it('não duplica: repetir a mesma operationId devolve o resultado conhecido', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    const r1 = await repo.salvar('op-unica', 'createTimeEntry', acrescentar(60));
    expect(r1.estado).toBe('confirmado');

    const r2 = await repo.salvar('op-unica', 'createTimeEntry', acrescentar(60));
    expect(r2.estado).toBe('ja_aplicado');

    const { revisao } = await repo.carregarRevisaoAtiva();
    expect(revisao!.timeEntries).toHaveLength(1);
  });

  it('resposta perdida após gravação é confirmada pelo recibo, sem repetir a mutação', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    graph.falhas.perderRespostaDoProximoPatch = true;
    const r = await repo.salvar('op-perdida', 'createTimeEntry', acrescentar(60));

    // A gravação ocorreu; a consulta ao recibo confirma em vez de repetir.
    expect(r.estado).toBe('confirmado');
    const { revisao } = await repo.carregarRevisaoAtiva();
    expect(revisao!.timeEntries).toHaveLength(1);
    expect(revisao!.receipts.some((x) => x.operationId === 'op-perdida')).toBe(true);
  });

  it('uma operação posterior legítima não invalida o recibo anterior', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    await repo.salvar('op-1', 'x', acrescentar(30));
    await repo.salvar('op-2', 'x', acrescentar(45));
    expect(await repo.confirmarPorRecibo('op-1')).toBe(true);
    expect(await repo.confirmarPorRecibo('op-2')).toBe(true);
  });
});

describe('AC-062 / AC-066 — falhas não publicam estado', () => {
  it('falha no envio deixa a revisão anterior ativa e não toca no ponteiro', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    const { ponteiro: antes } = await repo.lerCabeca();

    graph.falhas.falharProximoEnvio = true;
    const r = await repo.salvar('op-falha', 'createTimeEntry', acrescentar(60));

    expect(r.estado).toBe('erro');
    expect((r as { detalhe: string }).detalhe).toMatch(/Nada foi salvo/i);
    const { ponteiro: depois } = await repo.lerCabeca();
    expect(depois!.revisionId).toBe(antes!.revisionId);
    expect(graph.chamadas.patch).toBe(1); // apenas o da inicialização
  });

  it('AC-066: cota insuficiente não é salvamento', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    graph.falhas.quotaNoProximoEnvio = true;

    const r = await repo.salvar('op-quota', 'createTimeEntry', acrescentar(60));
    expect(r.estado).toBe('quota');
    expect((r as { detalhe: string }).detalhe).toMatch(/Nada foi salvo/i);

    const { revisao } = await repo.carregarRevisaoAtiva();
    expect(revisao!.timeEntries).toHaveLength(0);
  });

  it('uma revisão que fere invariantes não é publicada', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    const r = await repo.salvar('op-invalida', 'createTimeEntry', (base) => ({
      ...base,
      revisionId: crypto.randomUUID(),
      parentRevisionId: base.revisionId,
      timeEntries: [
        // 1.500 minutos numa data: acima do teto de 24 h.
        apontamento({ workspaceId: base.workspaceId, workDate: '2026-09-01', duracaoMinutos: 1500 }),
      ],
    }));

    expect(r.estado).toBe('invalido');
    expect((r as { problemas: string[] }).problemas.join(' ')).toMatch(/24h|duracao/i);
    expect(graph.chamadas.envio).toBe(1); // só o da revisão inicial
  });

  it('sessão expirada pede reautenticação sem afirmar salvamento', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    graph.falhas.erroNoProximoObterItem = new ErroGraph('Token expirado.', 'nao_autorizado', 401);

    const r = await repo.salvar('op-401', 'x', acrescentar(30));
    expect(r.estado).toBe('nao_autorizado');
    expect((r as { detalhe: string }).detalhe).not.toMatch(/salvo/i);
  });
});

describe('AC-065 — integridade da base', () => {
  it('conteúdo alterado por fora é detectado pelo hash, não tratado como base vazia', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    const { ponteiro } = await repo.lerCabeca();

    graph.alterarPorFora(ponteiro!.itemId, new TextEncoder().encode('{"revisionId":"outro"}'));
    await expect(repo.carregarRevisaoAtiva()).rejects.toBeInstanceOf(BaseCorrompida);
  });

  it('arquivo de revisão removido não recria uma base vazia silenciosamente', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);
    const { ponteiro } = await repo.lerCabeca();

    graph.removerPorFora(ponteiro!.itemId);
    await expect(repo.carregarRevisaoAtiva()).rejects.toThrow();
  });

  it('AC-057: a base de uma conta não é aberta por outra', async () => {
    const graph = new GraphSimulado();
    await baseInicializada(graph, 'conta-a');

    const repoB = new RepositorioOneDrive(graph, 'conta-b');
    await repoB.inicializar();
    await expect(repoB.carregarRevisaoAtiva()).rejects.toBeInstanceOf(BaseCorrompida);
  });
});

describe('AC-067 — restauração', () => {
  it('restaurar cria uma revisão nova e preserva a anterior', async () => {
    const graph = new GraphSimulado();
    const { repo } = await baseInicializada(graph);

    await repo.salvar('op-1', 'x', acrescentar(30));
    const checkpoint = (await repo.carregarRevisaoAtiva()).revisao!;
    await repo.salvar('op-2', 'x', acrescentar(45));

    expect((await repo.carregarRevisaoAtiva()).revisao!.timeEntries).toHaveLength(2);

    const r = await repo.restaurar(checkpoint, 'op-restaurar');
    expect(r.estado).toBe('confirmado');

    const depois = (await repo.carregarRevisaoAtiva()).revisao!;
    expect(depois.timeEntries).toHaveLength(1);
    expect(depois.revisionId).not.toBe(checkpoint.revisionId);
    // As revisões anteriores continuam gravadas, disponíveis para retorno.
    expect((await repo.listarRevisoes()).length).toBeGreaterThanOrEqual(4);
    expect(depois.audit.some((a) => a.operacao === 'restoreWorkspace')).toBe(true);
  });
});

describe('ponteiro', () => {
  let base: Revision;
  beforeEach(() => {
    base = revisaoInicial(novoWorkspace());
  });

  it('cabe no limite de 768 caracteres e não carrega texto de chamados', () => {
    const p = {
      version: 1 as const,
      workspaceId: base.workspaceId,
      revisionId: base.revisionId,
      itemId: '01ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
      sha256: 'a'.repeat(64),
    };
    const texto = serializarPonteiro(p);
    expect(texto.length).toBeLessThanOrEqual(LIMITE_PONTEIRO_CARACTERES);
    expect(lerPonteiro(texto)).toEqual(p);
    // Só schema, workspace, revisão, item e hash.
    expect(Object.keys(JSON.parse(texto)).sort()).toEqual(['itemId', 'revisionId', 'sha256', 'version', 'workspaceId']);
  });

  it('ponteiro ilegível é tratado como ausente, não como base vazia válida', () => {
    expect(lerPonteiro('não é json')).toBeNull();
    expect(lerPonteiro('')).toBeNull();
    expect(lerPonteiro('{"version":2}')).toBeNull();
  });
});
