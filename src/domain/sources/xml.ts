/**
 * Varredor de XML orientado a tags, para as partes OOXML que precisamos.
 *
 * Não é um parser genérico: não resolve DTD, entidades externas nem
 * `<!ENTITY>` — por construção, portanto, não há expansão de entidade nem XXE.
 * Só as cinco entidades predefinidas e referências numéricas são decodificadas.
 */

export interface TagXml {
  nome: string;
  atributos: Record<string, string>;
  /** `<c .../>` é uma tag que abre e fecha na mesma marcação. */
  autoFechada: boolean;
  fechamento: boolean;
  /** Posição logo após `>`, para leitura do texto seguinte. */
  fim: number;
}

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Decodifica apenas entidades predefinidas e referências numéricas. */
export function decodificarTextoXml(texto: string): string {
  if (!texto.includes('&')) return texto;
  return texto.replace(/&(#x?[0-9A-Fa-f]+|[a-zA-Z]+);/g, (inteiro, corpo: string) => {
    if (corpo.startsWith('#x') || corpo.startsWith('#X')) {
      const n = Number.parseInt(corpo.slice(2), 16);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : inteiro;
    }
    if (corpo.startsWith('#')) {
      const n = Number.parseInt(corpo.slice(1), 10);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : inteiro;
    }
    const conhecida = ENTIDADES[corpo];
    // Uma entidade não predefinida é devolvida literalmente, nunca expandida.
    return conhecida ?? inteiro;
  });
}

function lerAtributos(bruto: string): Record<string, string> {
  const atributos: Record<string, string> = {};
  const padrao = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;
  for (const m of bruto.matchAll(padrao)) {
    const nome = m[1] ?? m[3]!;
    const valor = m[2] ?? m[4] ?? '';
    atributos[nome] = decodificarTextoXml(valor);
  }
  return atributos;
}

/**
 * Percorre o XML emitindo tags. Ignora comentários, instruções de
 * processamento, declarações DOCTYPE e blocos CDATA são entregues como texto.
 */
export function* percorrerTags(xml: string): Generator<TagXml> {
  let i = 0;
  const n = xml.length;

  while (i < n) {
    const abre = xml.indexOf('<', i);
    if (abre < 0) return;

    // Comentário, CDATA, DOCTYPE e instrução de processamento são saltados.
    if (xml.startsWith('<!--', abre)) {
      const fim = xml.indexOf('-->', abre + 4);
      i = fim < 0 ? n : fim + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', abre)) {
      const fim = xml.indexOf(']]>', abre + 9);
      i = fim < 0 ? n : fim + 3;
      continue;
    }
    if (xml.startsWith('<!', abre) || xml.startsWith('<?', abre)) {
      const fim = xml.indexOf('>', abre + 2);
      i = fim < 0 ? n : fim + 1;
      continue;
    }

    const fecha = xml.indexOf('>', abre);
    if (fecha < 0) return;

    let corpo = xml.slice(abre + 1, fecha);
    const fechamento = corpo.startsWith('/');
    if (fechamento) corpo = corpo.slice(1);
    const autoFechada = corpo.endsWith('/');
    if (autoFechada) corpo = corpo.slice(0, -1);

    const espaco = corpo.search(/\s/);
    const nome = espaco < 0 ? corpo : corpo.slice(0, espaco);
    const atributos = espaco < 0 || fechamento ? {} : lerAtributos(corpo.slice(espaco));

    yield { nome, atributos, autoFechada, fechamento, fim: fecha + 1 };
    i = fecha + 1;
  }
}

/**
 * Texto de um elemento simples que começa em `posicao` (logo após a abertura),
 * até o fechamento correspondente. Concatena filhos de texto e CDATA.
 */
export function textoAte(xml: string, posicao: number, tagFechamento: string): { texto: string; fim: number } {
  const alvo = `</${tagFechamento}>`;
  const fim = xml.indexOf(alvo, posicao);
  const bruto = fim < 0 ? xml.slice(posicao) : xml.slice(posicao, fim);
  const semTags = bruto.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '');
  return { texto: decodificarTextoXml(semTags), fim: fim < 0 ? xml.length : fim + alvo.length };
}
