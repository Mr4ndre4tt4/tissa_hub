import { describe, expect, it } from 'vitest';
import { lerPonteiro, serializarPonteiro } from '../src/domain/entities/revisao';

const ponteiro = {
  version: 1 as const,
  workspaceId: '00000000-0000-4000-8000-000000000001',
  revisionId: '00000000-0000-4000-8000-000000000002',
  itemId: '0123456789ABCDEF!s0123456789abcdef0123456789abcdef',
  sha256: 'a'.repeat(64),
};

describe('ponteiro na descrição do OneDrive', () => {
  it('lê o JSON original sem alterar seus identificadores', () => {
    expect(lerPonteiro(serializarPonteiro(ponteiro))).toEqual(ponteiro);
  });

  it('lê JSON cujas aspas foram codificadas como entidades HTML', () => {
    const codificado = serializarPonteiro(ponteiro).replaceAll('"', '&quot;');
    expect(lerPonteiro(codificado)).toEqual(ponteiro);
  });

  it('lê o formato real com chaves e dois-pontos também codificados', () => {
    const codificado = serializarPonteiro(ponteiro)
      .replaceAll('{', '&#123;').replaceAll('}', '&#125;')
      .replaceAll(':', '&#58;').replaceAll('"', '&quot;');
    expect(codificado).toHaveLength(376);
    expect(lerPonteiro(codificado)).toEqual(ponteiro);
  });

  it('preserva entidades literais em um JSON que já é válido', () => {
    const literal = { ...ponteiro, itemId: 'item-&quot;-literal' };
    expect(lerPonteiro(serializarPonteiro(literal))).toEqual(literal);
  });

  it('aceita entidades numéricas hexadecimais sem renderizar HTML', () => {
    const codificado = serializarPonteiro(ponteiro).replaceAll('"', '&#x22;');
    expect(lerPonteiro(codificado)).toEqual(ponteiro);
  });

  it('não decodifica repetidamente nem aceita campos de outro tipo', () => {
    expect(lerPonteiro(serializarPonteiro(ponteiro).replaceAll('"', '&amp;quot;'))).toBeNull();
    expect(lerPonteiro(JSON.stringify({ ...ponteiro, itemId: 123 }))).toBeNull();
    expect(lerPonteiro('&#999999999999;')).toBeNull();
  });

  it('não interpreta HTML, JavaScript ou JSON incompleto como ponteiro', () => {
    for (const valor of ['<script>alert(1)</script>', '{&quot;version&quot;:1}', '&quot;texto&quot;']) {
      expect(lerPonteiro(valor)).toBeNull();
    }
  });
});
