/**
 * Composição, navegação e telas de entrada/conexão.
 *
 * Navegação: Meu dia · Chamados · Dashboard · Planejamento · Importações ·
 * Meu desenvolvimento · Configurações. O detalhe do chamado abre por ID.
 */

import { useEffect, useState } from 'react';
import { useApp, usarMensagemDeGravacao, type ModoDeOperacao } from './estado';
import { Aviso, Painel } from '../design/componentes';
import { integracaoConfigurada } from '../adapters/identity/msal';
import { MeuDia } from '../features/day/MeuDia';
import { Chamados } from '../features/tickets/Chamados';
import { DetalheChamado } from '../features/tickets/DetalheChamado';
import { Dashboard } from '../features/dashboard/Dashboard';
import { Planejamento } from '../features/planning/Planejamento';
import { Importacoes } from '../features/imports/Importacoes';
import { MeuDesenvolvimento } from '../features/development/MeuDesenvolvimento';
import { Configuracoes } from '../features/settings/Configuracoes';
import { MARCA_SINTETICA } from '../fixtures/demonstracao';

type Rota =
  | { tela: 'entrada' }
  | { tela: 'dia' }
  | { tela: 'chamados' }
  | { tela: 'chamado'; id: string }
  | { tela: 'dashboard' }
  | { tela: 'planejamento' }
  | { tela: 'importacoes' }
  | { tela: 'desenvolvimento' }
  | { tela: 'configuracoes' };

const MENU: { chave: Rota['tela']; rotulo: string }[] = [
  { chave: 'dia', rotulo: 'Meu dia' },
  { chave: 'chamados', rotulo: 'Chamados' },
  { chave: 'dashboard', rotulo: 'Dashboard' },
  { chave: 'planejamento', rotulo: 'Planejamento' },
  { chave: 'importacoes', rotulo: 'Importações' },
  { chave: 'desenvolvimento', rotulo: 'Meu desenvolvimento' },
  { chave: 'configuracoes', rotulo: 'Configurações' },
];

function lerRota(): Rota {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [tela, id] = hash.split('/');
  if (tela === 'chamado' && id) return { tela: 'chamado', id: decodeURIComponent(id) };
  const conhecida = MENU.find((m) => m.chave === tela);
  return conhecida ? ({ tela: conhecida.chave } as Rota) : { tela: 'entrada' };
}

/**
 * Verdadeiro quando a tela de login deve aparecer, mesmo com a rota em
 * "entrada" — que é tanto o estado antes de logar quanto o padrão sem hash
 * específico (inclusive logo depois de uma recuperação bem-sucedida, secção
 * 16.3, já conectada). Extraída como função pura porque o projeto não tem
 * infraestrutura de teste de componente React: um bug real aqui (recuperação
 * bem-sucedida devolvendo a pessoa para "Entrar com Microsoft", mesmo com a
 * base já aberta) só foi pego manualmente, contra a conta real.
 */
export function deveMostrarEntrada(modo: ModoDeOperacao, rotaTela: Rota['tela']): boolean {
  // O cache de autenticação vive só em memória. Recarregar uma rota interna
  // exige novo login; nunca exibir uma revisão vazia como se fosse a base.
  return modo === 'nao_configurado' ||
    (rotaTela === 'entrada' && modo !== 'conectado' && modo !== 'demonstrativo');
}

export function App() {
  const { modo, conta, sair } = useApp();
  const [rota, setRota] = useState<Rota>(lerRota);

  useEffect(() => {
    const aoMudar = () => setRota(lerRota());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  const navegar = (r: Rota) => {
    window.location.hash = r.tela === 'chamado' ? `/chamado/${encodeURIComponent(r.id)}` : `/${r.tela}`;
    setRota(r);
  };

  // `sair()` (estado.tsx) zera o modo, mas não sabe nada de rota — sem isto,
  // sair a partir de qualquer tela que não seja "entrada" (Configurações,
  // ou Escolher base/Recuperação com um hash preservado de outra sessão)
  // deixaria a pessoa numa tela "conectada" com modo já desconectado, em vez
  // de voltar para o login. Mesma classe do bug de deveMostrarEntrada.
  const aoSair = () => {
    void sair();
    navegar({ tela: 'entrada' });
  };

  // Enquanto a conexão está em curso, ou falta decidir sobre a base, essas
  // telas assumem: entrar no aplicativo sem base seria fingir que há dados.
  if (modo === 'conectando') return <Conectando />;
  if (modo === 'sem_base') return <EscolherBase aoSair={aoSair} />;
  if (modo === 'recuperacao') return <Recuperacao aoSair={aoSair} />;
  if (deveMostrarEntrada(modo, rota.tela)) {
    return <Entrada aoEntrar={() => navegar({ tela: 'dia' })} />;
  }

  const rotuloModo =
    modo === 'conectado' ? conta?.email ?? 'OneDrive pessoal' : modo === 'demonstrativo' ? 'Modo demonstrativo' : 'Sem conexão';

  return (
    <div className="aplicacao">
      <nav className="lateral" aria-label="Navegação principal">
        <div className="assinatura">
          Central de Chamados
          <span>{rotuloModo}</span>
        </div>
        <div className="navegacao">
          {MENU.map((m) => (
            <a
              key={m.chave}
              href={`#/${m.chave}`}
              aria-current={
                rota.tela === m.chave ||
                (m.chave === 'chamados' && rota.tela === 'chamado') ||
                (m.chave === 'dia' && rota.tela === 'entrada') // ver Tela(): "entrada" mostra Meu dia quando já conectado
                  ? 'page'
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                navegar({ tela: m.chave } as Rota);
              }}
            >
              {m.rotulo}
            </a>
          ))}
        </div>
      </nav>

      <main className="conteudo">
        <FaixaDeEstado />
        <Tela rota={rota} navegar={navegar} aoSair={aoSair} />
      </main>
    </div>
  );
}

function FaixaDeEstado() {
  const { modo, erroConexao } = useApp();
  const mensagem = usarMensagemDeGravacao();
  return (
    <>
      {modo === 'demonstrativo' && (
        <Aviso tipo="atencao" titulo="Modo demonstrativo.">
          {MARCA_SINTETICA} Nada é gravado no OneDrive; alterações ficam apenas nesta sessão do navegador.
        </Aviso>
      )}
      {erroConexao && (
        <Aviso tipo="atencao" titulo="Problema na conexão.">
          {erroConexao}
        </Aviso>
      )}
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
    </>
  );
}

function Tela({ rota, navegar, aoSair }: { rota: Rota; navegar: (r: Rota) => void; aoSair: () => void }) {
  switch (rota.tela) {
    case 'dia':
    // Conectada (ou em demonstração) mas ainda na rota padrão, sem hash
    // específico — "Meu dia" é a tela inicial dentro do app já aberto.
    case 'entrada':
      return <MeuDia />;
    case 'chamados':
      return <Chamados aoAbrir={(id) => navegar({ tela: 'chamado', id })} />;
    case 'chamado':
      return <DetalheChamado key={rota.id} ticketId={rota.id} aoVoltar={() => navegar({ tela: 'chamados' })} />;
    case 'dashboard':
      return <Dashboard />;
    case 'planejamento':
      // A sugestão leva ao formulário de apontamento; nada é gravado no caminho.
      return <Planejamento aoRegistrarEsforco={() => navegar({ tela: 'dia' })} />;
    case 'importacoes':
      return <Importacoes />;
    case 'desenvolvimento':
      return <MeuDesenvolvimento />;
    case 'configuracoes':
      return <Configuracoes aoSair={aoSair} />;
    default:
      return null;
  }
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="conteudo" style={{ maxWidth: 720, margin: '0 auto', paddingTop: 'var(--e7)' }}>
      <div className="assinatura" style={{ fontSize: 'var(--t-titulo)', marginBottom: 'var(--e5)' }}>
        Central de Chamados
        <span>Controle pessoal de chamados e esforço</span>
      </div>
      {children}
    </main>
  );
}

function Conectando() {
  const { progresso, conta } = useApp();
  return (
    <Moldura>
      <Painel>
        <h2>Conectando</h2>
        <p aria-live="polite">{progresso ?? 'Aguarde…'}</p>
        {conta && (
          <p className="rodape-nota">
            Conta ativa: {conta.nome} ({conta.email})
          </p>
        )}
      </Painel>
    </Moldura>
  );
}

/**
 * Autenticado, pasta do aplicativo pronta, sem revisão ativa.
 * Criar a base é operação explícita — nunca automática (secção 16.3).
 */
function EscolherBase({ aoSair }: { aoSair: () => void }) {
  const { conta, criarBase, recarregar, progresso, erroConexao } = useApp();
  const [enviando, setEnviando] = useState(false);

  return (
    <Moldura>
      <Painel>
        <h2>Nenhuma base encontrada nesta conta</h2>
        <p>
          Você está autenticado como <strong>{conta?.email}</strong> e a pasta do aplicativo já existe no seu OneDrive, mas ainda não há
          nenhuma base de dados criada.
        </p>
        <p>
          Isto é diferente de “erro de conexão”: a leitura funcionou e o resultado foi mesmo vazio. Criar a base é uma decisão sua, e não
          acontece sozinha.
        </p>

        {erroConexao && <Aviso tipo="atencao">{erroConexao}</Aviso>}
        {progresso && <Aviso tipo="informacao">{progresso}</Aviso>}

        <div className="acoes-linha" style={{ marginTop: 'var(--e5)' }}>
          <button
            type="button"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await criarBase();
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? 'Criando…' : 'Criar a base agora'}
          </button>
          <button type="button" className="secundario" disabled={enviando} onClick={() => void recarregar()}>
            Procurar de novo
          </button>
          <button type="button" className="discreto" disabled={enviando} onClick={aoSair}>
            Sair desta conta
          </button>
        </div>

        <p className="rodape-nota">
          A base fica na pasta do aplicativo, dentro do seu OneDrive pessoal. Nenhum dado vai para servidor deste projeto.
        </p>
      </Painel>
    </Moldura>
  );
}

/**
 * Ponteiro ausente ou base que não confere: nunca recriar por cima.
 * Recuperar é escolher, deliberadamente, uma das revisões já gravadas
 * (secção 16.3) — nunca uma escolha automática do aplicativo.
 */
function Recuperacao({ aoSair }: { aoSair: () => void }) {
  const { erroConexao, recarregar, listarRevisoesRecuperaveis, recuperarRevisao, progresso } = useApp();
  const [revisoes, setRevisoes] = useState<{ id: string; nome: string }[] | null>(null);
  const [erroListagem, setErroListagem] = useState<string | null>(null);
  const [recuperando, setRecuperando] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setErroListagem(null);
    listarRevisoesRecuperaveis()
      .then((r) => {
        if (!cancelado) setRevisoes([...r].sort((a, b) => b.nome.localeCompare(a.nome)));
      })
      .catch((e) => {
        if (!cancelado) setErroListagem(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelado = true;
    };
  }, [listarRevisoesRecuperaveis]);

  return (
    <Moldura>
      <Painel>
        <h2>Recuperação necessária</h2>
        <Aviso tipo="atencao" titulo="A base não foi aberta.">
          {erroConexao ?? 'A base existente não pôde ser validada.'}
        </Aviso>
        <p>
          O aplicativo <strong>não</strong> vai criar uma base vazia por cima do que já existe. As revisões gravadas continuam no seu
          OneDrive, na pasta do aplicativo. Escolha qual delas vira a base ativa — nomeadas pela data e hora em que foram gravadas.
        </p>

        {progresso && <Aviso tipo="informacao">{progresso}</Aviso>}
        {erroListagem && <Aviso tipo="atencao" titulo="Não foi possível listar as revisões.">{erroListagem}</Aviso>}

        {revisoes && revisoes.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--e3)' }}>
            {revisoes.map((r) => (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--e3)' }}>
                <code style={{ wordBreak: 'break-all' }}>{r.nome}</code>
                <button
                  type="button"
                  disabled={recuperando !== null}
                  onClick={async () => {
                    setRecuperando(r.id);
                    try {
                      await recuperarRevisao(r.id);
                    } finally {
                      setRecuperando(null);
                    }
                  }}
                >
                  {recuperando === r.id ? 'Recuperando…' : 'Recuperar esta'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {revisoes && revisoes.length === 0 && <p className="rodape-nota">Nenhuma revisão encontrada na pasta do aplicativo.</p>}

        <div className="acoes-linha">
          <button type="button" className="secundario" onClick={() => void recarregar()}>
            Tentar de novo
          </button>
          <button type="button" className="discreto" onClick={aoSair}>
            Sair desta conta
          </button>
        </div>
      </Painel>
    </Moldura>
  );
}

/**
 * Tela de entrada (secção 4.1). Sem formulário próprio de senha.
 * Sem configuração, dizemos exatamente isso — nunca um botão que finge conectar.
 */
function Entrada({ aoEntrar }: { aoEntrar: () => void }) {
  const { config, entrarNoModoDemonstrativo, entrarComMicrosoft, erroConexao } = useApp();
  const configurada = integracaoConfigurada(config);

  const [entrando, setEntrando] = useState(false);
  return (
    <main className="pagina-login">
      <section className="cartao-login" aria-labelledby="titulo-login">
        <div className="simbolo-login" aria-hidden="true">✓</div>
        <h1 id="titulo-login">Central de Chamados</h1>
        <p className="descricao-login">Seus chamados e seu dia de trabalho, em um só lugar.</p>
        {erroConexao && <Aviso tipo="atencao" titulo="Não foi possível entrar.">{erroConexao}</Aviso>}
        {configurada ? (
          <>
            <button className="botao-login" type="button" disabled={entrando} onClick={async () => {
              setEntrando(true);
              try { await entrarComMicrosoft(); } finally { setEntrando(false); }
            }}>{entrando ? 'Conectando…' : 'Entrar com Microsoft'}</button>
            <p className="rodape-nota">Use sua conta Microsoft pessoal. Seus dados ficam no seu OneDrive.</p>
          </>
        ) : <Aviso tipo="atencao" titulo="Login indisponível.">A integração Microsoft ainda precisa ser configurada.</Aviso>}
        <button type="button" className="discreto demonstracao-login" onClick={() => { entrarNoModoDemonstrativo(); aoEntrar(); }}>Ver a demonstração</button>
        <details className="detalhes-login">
          <summary>Sobre o acesso aos seus dados</summary>
          <p>O login é feito pela Microsoft. O aplicativo usa a pasta Central de Chamados no seu OneDrive pessoal para salvar e recuperar seus registros.</p>
          <p>A permissão solicitada permite ler e gravar arquivos no OneDrive inteiro, mas o aplicativo limita seu uso à própria pasta. Nenhum dado é guardado em um servidor deste projeto.</p>
          <p>A demonstração usa dados fictícios e não grava no OneDrive.</p>
        </details>
      </section>
    </main>
  );
}
