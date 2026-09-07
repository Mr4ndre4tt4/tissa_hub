/**
 * Composição, navegação e tela de entrada.
 *
 * Navegação: Meu dia · Chamados · Dashboard · Planejamento · Importações ·
 * Meu desenvolvimento · Configurações. O detalhe do chamado abre por ID.
 */

import { useEffect, useState } from 'react';
import { useApp, usarMensagemDeGravacao } from './estado';
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

export function App() {
  const { modo } = useApp();
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

  if (rota.tela === 'entrada') return <Entrada aoEntrar={() => navegar({ tela: 'dia' })} />;

  return (
    <div className="aplicacao">
      <nav className="lateral" aria-label="Navegação principal">
        <div className="assinatura">
          Central de Chamados
          <span>{modo === 'conectado' ? 'OneDrive pessoal' : 'Modo demonstrativo'}</span>
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
  const { modo } = useApp();
  const mensagem = usarMensagemDeGravacao();
  return (
    <>
      {modo !== 'conectado' && (
        <Aviso tipo="atencao" titulo="Modo demonstrativo.">
          {MARCA_SINTETICA} Nada é gravado no OneDrive: a integração Microsoft ainda não está configurada. Alterações ficam apenas nesta
          sessão do navegador.
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

/**
 * Tela de entrada (secção 4.1). Sem formulário próprio de senha.
 * Quando a integração não está configurada, dizemos exatamente isso — nunca
 * apresentamos um botão que finge conectar.
 */
function Entrada({ aoEntrar }: { aoEntrar: () => void }) {
  const { config, entrarNoModoDemonstrativo } = useApp();
  const configurada = integracaoConfigurada(config);

  return (
    <main className="conteudo" style={{ maxWidth: 720, margin: '0 auto', paddingTop: 'var(--e7)' }}>
      <div className="assinatura" style={{ fontSize: 'var(--t-titulo)', marginBottom: 'var(--e5)' }}>
        Central de Chamados
        <span>Controle pessoal de chamados e esforço</span>
      </div>

      <Painel>
        <h2>Entrar</h2>
        <p>
          Seus dados ficam no <strong>seu OneDrive pessoal</strong>, na pasta do aplicativo. Nada é guardado num servidor deste projeto e
          não existe formulário de senha aqui: a autenticação é feita pela própria Microsoft.
        </p>

        {configurada ? (
          <>
            <div className="acoes-linha" style={{ marginTop: 'var(--e5)' }}>
              <button type="button" onClick={aoEntrar}>
                Entrar com Microsoft
              </button>
            </div>
            <p className="rodape-nota">
              Você será levado à tela da Microsoft e voltará para cá. Depois de autenticar, o aplicativo mostra a conta ativa e pede o
              consentimento antes de criar ou abrir a base.
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
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  entrarNoModoDemonstrativo();
                  aoEntrar();
                }}
              >
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
          <li>Registro de aplicativo Microsoft com suporte a conta pessoal, client ID e redirect URI.</li>
          <li>Consentimento da pessoa para o escopo da pasta do aplicativo.</li>
          <li>Definição da hospedagem HTTPS e autorização para publicar.</li>
          <li>Vínculo com a planilha no OneDrive e o fuso das extrações CS3.</li>
          <li>Regras de calendário e de follow-up, e a conciliação dos históricos.</li>
          <li>Licença e arquivo da fonte Magnetik — até lá, o fallback do sistema fica em uso e declarado.</li>
        </ul>
      </Painel>
    </main>
  );
}
