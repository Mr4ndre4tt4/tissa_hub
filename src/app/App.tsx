/**
 * Composição, navegação e telas de entrada/conexão.
 *
 * Navegação: Meu dia · Chamados · Dashboard · Planejamento · Importações ·
 * Meu desenvolvimento · Configurações. O detalhe do chamado abre por ID.
 */

import { useEffect, useState } from 'react';
import { useApp, usarMensagemDeGravacao } from './estado';
import { Aviso, EstadoVazio, Painel } from '../design/componentes';
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

/** O retorno do provedor deve sair da entrada somente após conexão real. */
export function deveAbrirAplicacaoAposConectar(modo: string, tela: Rota['tela']): boolean {
  return modo === 'conectado' && tela === 'entrada';
}

function lerRota(): Rota {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [tela, id] = hash.split('/');
  if (tela === 'chamado' && id) return { tela: 'chamado', id: decodeURIComponent(id) };
  const conhecida = MENU.find((m) => m.chave === tela);
  return conhecida ? ({ tela: conhecida.chave } as Rota) : { tela: 'entrada' };
}

export function App() {
  const { modo, conta } = useApp();
  const [rota, setRota] = useState<Rota>(lerRota);

  useEffect(() => {
    const aoMudar = () => setRota(lerRota());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  /*
   * O retorno do login Microsoft abre novamente a URL raiz. A conexão é
   * concluída de forma assíncrona pelo ProvedorApp; quando ela termina, não
   * podemos continuar mostrando a tela de entrada como se o login tivesse
   * falhado. O modo demonstrativo já navega pelo callback do botão, enquanto
   * a autenticação por redirecionamento precisa desta transição explícita.
  */
  useEffect(() => {
    if (deveAbrirAplicacaoAposConectar(modo, rota.tela)) {
      window.location.hash = '/dia';
      setRota({ tela: 'dia' });
    }
  }, [modo, rota.tela]);

  const navegar = (r: Rota) => {
    window.location.hash = r.tela === 'chamado' ? `/chamado/${encodeURIComponent(r.id)}` : `/${r.tela}`;
    setRota(r);
  };

  // Enquanto a conexão está em curso, ou falta decidir sobre a base, essas
  // telas assumem: entrar no aplicativo sem base seria fingir que há dados.
  if (modo === 'conectando') return <Conectando />;
  if (modo === 'sem_base') return <EscolherBase />;
  if (modo === 'recuperacao') return <Recuperacao />;
  if (rota.tela === 'entrada') return <Entrada aoEntrar={() => navegar({ tela: 'dia' })} />;

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
              aria-current={rota.tela === m.chave || (m.chave === 'chamados' && rota.tela === 'chamado') ? 'page' : undefined}
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
        <Tela rota={rota} navegar={navegar} />
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

function Tela({ rota, navegar }: { rota: Rota; navegar: (r: Rota) => void }) {
  switch (rota.tela) {
    case 'dia':
      return <MeuDia />;
    case 'chamados':
      return <Chamados aoAbrir={(id) => navegar({ tela: 'chamado', id })} />;
    case 'chamado':
      return <DetalheChamado ticketId={rota.id} aoVoltar={() => navegar({ tela: 'chamados' })} />;
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
      return <Configuracoes />;
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
function EscolherBase() {
  const { conta, criarBase, recarregar, sair, progresso, erroConexao } = useApp();
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
          <button type="button" className="discreto" disabled={enviando} onClick={() => void sair()}>
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

/** Ponteiro ausente ou base que não confere: nunca recriar por cima. */
function Recuperacao() {
  const { erroConexao, recarregar, sair } = useApp();
  return (
    <Moldura>
      <Painel>
        <h2>Recuperação necessária</h2>
        <Aviso tipo="atencao" titulo="A base não foi aberta.">
          {erroConexao ?? 'A base existente não pôde ser validada.'}
        </Aviso>
        <p>
          O aplicativo <strong>não</strong> vai criar uma base vazia por cima do que já existe. As revisões gravadas continuam no seu
          OneDrive, na pasta do aplicativo, e podem ser recuperadas.
        </p>
        <div className="acoes-linha">
          <button type="button" className="secundario" onClick={() => void recarregar()}>
            Tentar de novo
          </button>
          <button type="button" className="discreto" onClick={() => void sair()}>
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
  const precisaAtivarOneDrive = erroConexao?.includes('https://onedrive.live.com/') ?? false;

  return (
    <Moldura>
      <Painel>
        <h2>Entrar</h2>
        <p>
          Seus dados ficam no <strong>seu OneDrive pessoal</strong>, na pasta do aplicativo. Nada é guardado num servidor deste projeto e
          não existe formulário de senha aqui: a autenticação é feita pela própria Microsoft.
        </p>

        {erroConexao && (
          <Aviso tipo="atencao" titulo="Última tentativa falhou.">
            <p>{erroConexao}</p>
            {precisaAtivarOneDrive && (
              <p>
                <a href="https://onedrive.live.com/" target="_blank" rel="noreferrer">
                  Abrir o OneDrive desta conta
                </a>
                . Conclua a tela inicial, se aparecer, e aguarde a lista de arquivos carregar. <strong>Não crie nenhuma pasta manualmente:</strong>{' '}
                a Microsoft cria a pasta correta para este aplicativo.
              </p>
            )}
          </Aviso>
        )}

        {configurada ? (
          <>
            <div className="acoes-linha" style={{ marginTop: 'var(--e5)' }}>
              <button type="button" onClick={() => void entrarComMicrosoft()}>
                Entrar com Microsoft
              </button>
              <button type="button" className="secundario" onClick={() => { entrarNoModoDemonstrativo(); aoEntrar(); }}>
                Ver a demonstração
              </button>
            </div>
            <p className="rodape-nota">
              Você será levado à tela da Microsoft e voltará para cá. Na primeira vez será pedido o seu consentimento para o aplicativo
              usar a própria pasta dele no seu OneDrive.
            </p>
          </>
        ) : (
          <>
            <Aviso tipo="atencao" titulo="Integração Microsoft não configurada.">
              Falta informar o <strong>client ID</strong> e o <strong>redirect URI</strong> de um registro de aplicativo Microsoft que
              aceite contas pessoais. Enquanto isso, o login está desativado — este aplicativo não simula uma conexão.
            </Aviso>
            <p>Você pode conhecer a interface com dados inventados, claramente separados de qualquer base real:</p>
            <div className="acoes-linha">
              <button type="button" className="secundario" onClick={() => { entrarNoModoDemonstrativo(); aoEntrar(); }}>
                Abrir o modo demonstrativo
              </button>
            </div>
            <p className="rodape-nota">
              No modo demonstrativo nenhuma alteração é gravada em lugar nenhum, e o aplicativo nunca dirá “Salvo no OneDrive”.
            </p>
          </>
        )}
      </Painel>

      <Painel titulo="O que ainda depende de configuração">
        <ul>
          <li>Consentimento da sua conta para o aplicativo usar a própria pasta no OneDrive.</li>
          <li>A prova técnica de gravação e concorrência na conta real (secção 16.5).</li>
          <li>Vínculo com a planilha no OneDrive e o fuso das extrações CS3.</li>
          <li>Regras de calendário e de follow-up, e a conciliação dos históricos.</li>
          <li>Licença e arquivo da fonte Magnetik — até lá, o fallback do sistema fica em uso e declarado.</li>
        </ul>
      </Painel>

      {!configurada && (
        <Painel>
          <EstadoVazio titulo="Nada foi conectado ainda">
            Nenhuma conta Microsoft foi autenticada e nenhum dado saiu deste navegador.
          </EstadoVazio>
        </Painel>
      )}
    </Moldura>
  );
}
