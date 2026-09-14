/**
 * `deveMostrarEntrada()` (`App.tsx`) — a rota "entrada" é tanto o estado
 * antes de logar quanto o padrão sem hash específico. Um bug real, pego
 * contra a conta real (não em teste — o projeto não tem infraestrutura de
 * teste de componente React), fazia uma recuperação bem-sucedida (secção
 * 16.3) devolver a pessoa para "Entrar com Microsoft" mesmo com a base já
 * aberta, porque a checagem de rota vinha antes da checagem de `modo`.
 */
import { describe, expect, it } from 'vitest';
import { deveMostrarEntrada } from '../src/app/App';
import type { ModoDeOperacao } from '../src/app/estado';

describe('deveMostrarEntrada', () => {
  it('mostra a tela de login na rota "entrada" antes de conectar', () => {
    const modosDeslogados: ModoDeOperacao[] = ['nao_configurado', 'conectando', 'sem_base', 'recuperacao'];
    for (const modo of modosDeslogados) {
      expect(deveMostrarEntrada(modo, 'entrada')).toBe(true);
    }
  });

  it('NÃO mostra a tela de login na rota "entrada" quando já conectado ou em demonstração', () => {
    // O caso que realmente aconteceu: recuperarApontandoPara() publica o
    // ponteiro e o modo vira 'conectado', mas a rota nunca muda sozinha — a
    // pessoa continua em "entrada" até clicar em algo.
    expect(deveMostrarEntrada('conectado', 'entrada')).toBe(false);
    expect(deveMostrarEntrada('demonstrativo', 'entrada')).toBe(false);
  });

  it('pede login ao reabrir uma rota interna sem sessão, em vez de mostrar uma base vazia', () => {
    for (const tela of ['dia', 'chamados', 'importacoes', 'configuracoes'] as const) {
      expect(deveMostrarEntrada('nao_configurado', tela)).toBe(true);
    }
  });

  it('mantém as rotas internas nas sessões e nos fluxos de conexão já iniciados', () => {
    const todosOsModos: ModoDeOperacao[] = [
      'demonstrativo',
      'conectando',
      'sem_base',
      'conectado',
      'recuperacao',
    ];
    for (const modo of todosOsModos) {
      expect(deveMostrarEntrada(modo, 'dia')).toBe(false);
      expect(deveMostrarEntrada(modo, 'configuracoes')).toBe(false);
    }
  });
});
