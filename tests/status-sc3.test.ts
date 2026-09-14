import { expect, it } from 'vitest';
import { STATUS_SC3, normalizarStatusSc3, statusSc3Encerrado } from '../src/domain/entities/statusSc3';
import { exibirStatusCs3 } from '../src/domain/entities/celulas';
import { periodoDoMes } from '../src/domain/time/datas';
it('oferece exatamente os sete status informados', () => {
 expect(STATUS_SC3).toEqual(['Waiting External','Waiting User','Went On Fulfillment','Update','Working','Resolved','Closed']);
});
it.each(['Waiting External','Waiting User','Went On Fulfillment','Update','Working','Resolved','Closed'])('reconhece %s nas telas', s => {
 expect(exibirStatusCs3(s).naoMapeado).toBe(false);
});
it('agrupa grafias antigas sem confundir estados finais e em andamento', () => {
 expect(normalizarStatusSc3('Wait on User')).toBe('Waiting User');
 expect(normalizarStatusSc3('WAIT ON EXTERNAL')).toBe('Waiting External');
 expect(normalizarStatusSc3('Updated')).toBe('Update');
 expect(normalizarStatusSc3('Estado futuro')).toBe('Estado futuro');
 expect(statusSc3Encerrado(' closed ')).toBe(true); expect(statusSc3Encerrado('Resolved')).toBe(true);
 expect(statusSc3Encerrado('Went On Fulfillment')).toBe(false); expect(statusSc3Encerrado('Update')).toBe(false);
});
it('calcula o mês da data atual, inclusive ano bissexto e troca de ano', () => {
 expect(periodoDoMes('2030-12-15')).toEqual({inicio:'2030-12-01',fim:'2030-12-31'});
 expect(periodoDoMes('2028-02-15')).toEqual({inicio:'2028-02-01',fim:'2028-02-29'});
 expect(periodoDoMes('2027-02-15')).toEqual({inicio:'2027-02-01',fim:'2027-02-28'});
});

it('conta grafias antigas e atuais no mesmo grupo do dashboard', async () => {
 const { revisaoDemonstrativa } = await import('../src/fixtures/demonstracao');
 const { chamadosPorStatus } = await import('../src/domain/metrics/indicadores');
 const r = revisaoDemonstrativa(); r.tickets[0]!.oficial!.statusBruto = 'Wait on User'; r.tickets[1]!.oficial!.statusBruto = 'Waiting User';
 const grupo = chamadosPorStatus(r).oficial.find(s => s.bruto === 'Waiting User');
 expect(grupo?.quantidade).toBe(2);
 expect(r.tickets[0]!.oficial!.statusBruto).toBe('Wait on User');
});

it('preserva o rótulo personalizado quando a grafia antiga tem equivalente atual', () => {
 expect(exibirStatusCs3('Update', { UPDATED: 'Revisar no meu fluxo' }).amigavel).toBe('Revisar no meu fluxo');
});
