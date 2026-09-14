// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProvedorApp, useApp, type ContextoApp } from '../src/app/estado';
import { GraphSimulado } from '../src/adapters/graph/graphSimulado';
import { ErroGraph } from '../src/adapters/graph/cliente';
import { RepositorioOneDrive } from '../src/adapters/storage/repositorio';
import { novoWorkspace, revisaoInicial } from '../src/domain/entities/revisao';

let ctx: ContextoApp;
let host: HTMLDivElement;
let root: Root;
let graph: GraphSimulado;
let repo: RepositorioOneDrive;
function Probe() { ctx = useApp(); return <div>{ctx.modo}</div>; }
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  graph = new GraphSimulado(); repo = new RepositorioOneDrive(graph, 'conta-a');
  await repo.inicializar();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<ProvedorApp repositorioDeTeste={repo}><Probe /></ProvedorApp>));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('mantém a recuperação se a releitura falhar por rede', async () => {
  await repo.publicarRevisaoInicial(revisaoInicial(novoWorkspace()), 'init');
  const { item } = await repo.lerCabeca();
  await graph.atualizarDescricao(item.id, '', item.eTag);
  await act(async () => ctx.recarregar());
  expect(ctx.modo).toBe('recuperacao');
  graph.falhas.erroNoProximoObterItem = new ErroGraph('Sem conexão', 'transporte');
  await act(async () => ctx.recarregar());
  expect(ctx.modo).toBe('recuperacao');
});

it('encaminha uma criação sem publicação confirmada para recuperação', async () => {
  await act(async () => ctx.recarregar());
  vi.spyOn(graph, 'atualizarDescricao').mockImplementation(async (id) => graph.obterItem(id));
  await act(async () => ctx.criarBase());
  expect(ctx.modo).toBe('recuperacao');
  expect(await repo.listarRevisoes()).toHaveLength(1);
});

it('não trata uma base desconectada como demonstração para aceitar alterações', async () => {
  await act(async () => ctx.recarregar());
  expect(ctx.modo).toBe('sem_base');
  const antes = ctx.revisao.revisionId;
  let resultado: string | undefined;
  await act(async () => { resultado = await ctx.mutar('x', b => ({ ...b, revisionId: crypto.randomUUID() })); });
  expect(resultado).toBe('erro');
  expect(ctx.revisao.revisionId).toBe(antes);
});
