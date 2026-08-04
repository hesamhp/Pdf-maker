declare module '@pdf-lib/fontkit' {
  const fontkit: any;
  export default fontkit;
}

declare module 'fontkit' {
  export function create(buffer: ArrayBuffer | Buffer): any;
  export function registerFormat(format: any): void;
  export const defaultLanguage: string;
  export function setDefaultLanguage(lang: string): void;
  export let logErrors: boolean;
}

declare module 'arabic-reshaper' {
  export function convertArabic(text: string): string;
  export function convertArabicBack(text: string): string;
}

declare module 'bidi-js' {
  interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }

  interface Bidi {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): EmbeddingLevels;
    getReorderSegments(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): Array<[number, number]>;
    getMirroredCharactersMap(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): Map<number, string>;
    getMirroredCharacter(char: string): string | null;
    getBidiCharTypeName(char: string): string;
  }

  function bidiFactory(): Bidi;
  export default bidiFactory;
}
