import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Celula } from '../../domain/entities/tipos';
import { periodoDoMes } from '../../domain/time/datas';
import type { Periodo } from '../../domain/metrics/indicadores';

export interface FiltrosChamados {
  busca: string;
  celula: 'todas' | Celula;
  status: string;
  situacao: 'todos' | 'abertos' | 'encerrados';
  somentePendencias: boolean;
  densidade: 'normal' | 'compacta';
  ordem: 'recentes' | 'referencia' | 'prazo';
  periodo: Periodo;
}
export function filtrosIniciais(data: string): FiltrosChamados {
  return { busca: '', celula: 'todas', status: 'todos', situacao: 'todos', somentePendencias: false, densidade: 'normal', ordem: 'recentes', periodo: periodoDoMes(data) };
}
export function textoParaBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR');
}
const ContextoLista = createContext<{ filtros: FiltrosChamados; setFiltros: Dispatch<SetStateAction<FiltrosChamados>>; limpar: () => void } | null>(null);
/** Preferências apenas em memória; o provider é desmontado ao sair da conta. */
export function ProvedorListaChamados({ dataReferencia, children }: { dataReferencia: string; children: ReactNode }) {
  const [filtros, setFiltros] = useState(() => filtrosIniciais(dataReferencia));
  return <ContextoLista.Provider value={{ filtros, setFiltros, limpar: () => setFiltros(filtrosIniciais(dataReferencia)) }}>{children}</ContextoLista.Provider>;
}
export function useListaChamados() {
  const valor = useContext(ContextoLista);
  if (!valor) throw new Error('Lista de chamados precisa do provedor de filtros.');
  return valor;
}
