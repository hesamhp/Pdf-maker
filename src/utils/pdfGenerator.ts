import { PDFDocument, PDFEmbeddedPage } from 'pdf-lib';
// @ts-ignore
import fontkit from '@pdf-lib/fontkit';

// ==========================================
// Reliable approach: render text on an HTML Canvas
// (the browser natively handles RTL, bidi, and shaping)
// then embed the canvas image into the PDF page.
// ==========================================

/** Detect if a line's base direction is RTL */
function isLineRTL(text: string): boolean {
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (
      (c >= 0x0600 && c <= 0x06FF) ||
      (c >= 0x0750 && c <= 0x077F) ||
      (c >= 0xFB50 && c <= 0xFDFF) ||
      (c >= 0xFE70 && c <= 0xFEFF) ||
      (c >= 0x0590 && c <= 0x05FF)
    )
      return true;
    if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) return false;
  }
  return true;
}

/** Ensure the web font is loaded before we paint on a canvas. */
async function ensureFont(): Promise<void> {
  // Dynamically load the font if not yet available
  if (!document.fonts.check('16px Vazirmatn')) {
    try {
      const fontFace = new FontFace(
        'Vazirmatn',
        "url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2')",
        { weight: '400', style: 'normal' },
      );
      const loaded = await fontFace.load();
      document.fonts.add(loaded);
    } catch (e) {
      console.warn('Font load failed, using fallback', e);
    }
  }
  // Wait until the font is really ready
  try {
    await document.fonts.ready;
  } catch { /* */ }
}

/** Simple word-wrap using a scratch canvas for measurement. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];

  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }

    const words = para.split(' ');
    let line = '';

    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (ctx.measureText(cand).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = cand;
      }
    }
    if (line) out.push(line);
  }

  return out;
}

/**
 * Render an array of text lines on an off-screen canvas.
 * Returns a PNG data-URL (with transparency).
 */
function renderLinesToPNG(
  lines: string[],
  areaW: number,
  areaH: number,
  fontSize: number,
  lineHeight: number,
  colorCSS: string,
): string {
  const SCALE = 3;                       // 3× for sharp text
  const canvas = document.createElement('canvas');
  canvas.width  = Math.ceil(areaW * SCALE);
  canvas.height = Math.ceil(areaH * SCALE);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  const spacing = fontSize * lineHeight;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;

    const rtl = isLineRTL(line);

    ctx.save();
    ctx.font      = `${fontSize}px Vazirmatn, sans-serif`;
    ctx.fillStyle = colorCSS;
    ctx.direction   = rtl ? 'rtl' : 'ltr';
    ctx.textAlign   = rtl ? 'right' : 'left';
    ctx.textBaseline = 'top';

    const x = rtl ? areaW : 0;
    const y = i * spacing;

    ctx.fillText(line, x, y);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

// ==========================================
// Public API
// ==========================================

export interface PdfGenerationOptions {
  templateFile: ArrayBuffer;
  content: string;
  fileName: string;
  topMargin: number;
  bottomMargin: number;
  leftMargin: number;
  rightMargin: number;
  fontSize: number;
  lineHeight: number;
  textColor: { r: number; g: number; b: number };
}

export async function generatePdf(
  opts: PdfGenerationOptions,
): Promise<Uint8Array> {
  const {
    templateFile, content,
    topMargin, bottomMargin, leftMargin, rightMargin,
    fontSize, lineHeight, textColor,
  } = opts;

  // ── make sure the web font is ready ──
  await ensureFont();

  // ── load template ──
  const tplDoc = await PDFDocument.load(templateFile);
  const tplPages = tplDoc.getPages();
  if (!tplPages.length) throw new Error('قالب PDF صفحه‌ای ندارد');
  const { width: W, height: H } = tplPages[0].getSize();

  // ── new doc ──
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [tplEmbed] = await pdf.embedPdf(tplDoc, [0]);

  // ── geometry (in PDF points) ──
  const areaW   = W - leftMargin - rightMargin;
  const areaH   = H - topMargin - bottomMargin;
  const spacing = fontSize * lineHeight;
  const lpp     = Math.max(1, Math.floor(areaH / spacing));

  // ── word-wrap using a scratch canvas ──
  const scratch    = document.createElement('canvas').getContext('2d')!;
  scratch.font     = `${fontSize}px Vazirmatn, sans-serif`;
  const lines      = wrapLines(scratch, content, areaW);

  // ── paginate ──
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += lpp)
    chunks.push(lines.slice(i, i + lpp));
  if (!chunks.length) chunks.push([]);

  // ── color ──
  const colorCSS = `rgb(${textColor.r},${textColor.g},${textColor.b})`;

  // ── render each page ──
  for (const chunk of chunks) {
    const page = pdf.addPage([W, H]);

    // 1. draw template background
    page.drawPage(tplEmbed as PDFEmbeddedPage, { x: 0, y: 0, width: W, height: H });

    // 2. render text to a transparent PNG via Canvas
    const dataUrl = renderLinesToPNG(chunk, areaW, areaH, fontSize, lineHeight, colorCSS);

    // 3. embed the PNG into the page
    const pngBytes = dataUrlToBytes(dataUrl);
    const pngImage = await pdf.embedPng(pngBytes);

    // PDF y-axis is bottom-up; place the image in the text area
    page.drawImage(pngImage, {
      x:      leftMargin,
      y:      bottomMargin,
      width:  areaW,
      height: areaH,
    });
  }

  return pdf.save();
}

/** Convert a data-URL to a Uint8Array */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const bin    = atob(base64);
  const bytes  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function downloadPdf(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name.endsWith('.pdf') ? name : `${name}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
