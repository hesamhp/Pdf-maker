import { PDFDocument } from 'pdf-lib';

// ==========================================
// Canvas-based text rendering for correct RTL
// Optimised: copyPages (shared resources), 2× scale, per-line cache
// ==========================================

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

async function ensureFont(): Promise<void> {
  if (!document.fonts.check('16px Vazirmatn')) {
    try {
      const ff = new FontFace(
        'Vazirmatn',
        "url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2')",
        { weight: '400', style: 'normal' },
      );
      document.fonts.add(await ff.load());
    } catch (e) {
      console.warn('Font load fallback', e);
    }
  }
  try { await document.fonts.ready; } catch { /* */ }
}

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

// ── render one line → small PNG bytes ──

const SCALE = 3;

function renderLineToPNG(
  text: string,
  areaW: number,
  fontSize: number,
  colorCSS: string,
): Uint8Array | null {
  if (!text || !text.trim()) return null;

  const rtl   = isLineRTL(text);
  const lineH = Math.ceil(fontSize * 1.4);

  const canvas  = document.createElement('canvas');
  canvas.width  = Math.ceil(areaW * SCALE);
  canvas.height = Math.ceil(lineH * SCALE);
  const ctx     = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  ctx.font         = `${fontSize}px Vazirmatn, sans-serif`;
  ctx.fillStyle    = colorCSS;
  ctx.direction    = rtl ? 'rtl' : 'ltr';
  ctx.textAlign    = rtl ? 'right' : 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, rtl ? areaW : 0, 0);

  return dataUrlToBytes(canvas.toDataURL('image/png'));
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const u8  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
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

  await ensureFont();

  // ── load template ──
  const tplDoc = await PDFDocument.load(templateFile);
  if (!tplDoc.getPageCount()) throw new Error('قالب PDF صفحه‌ای ندارد');
  const { width: W, height: H } = tplDoc.getPage(0).getSize();

  // ── new doc ──
  const pdf = await PDFDocument.create();

  // ── geometry ──
  const areaW   = W - leftMargin - rightMargin;
  const areaH   = H - topMargin - bottomMargin;
  const spacing = fontSize * lineHeight;
  const lpp     = Math.max(1, Math.floor(areaH / spacing));

  // ── word-wrap ──
  const scratch = document.createElement('canvas').getContext('2d')!;
  scratch.font  = `${fontSize}px Vazirmatn, sans-serif`;
  const lines   = wrapLines(scratch, content, areaW);

  // ── paginate ──
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += lpp)
    chunks.push(lines.slice(i, i + lpp));
  if (!chunks.length) chunks.push([]);

  // ── colour ──
  const colorCSS = `rgb(${textColor.r},${textColor.g},${textColor.b})`;

  // ── pre-render unique lines once → cache PNG bytes ──
  const pngCache = new Map<string, Uint8Array>();
  for (const line of new Set(lines.filter(l => l.trim()))) {
    const png = renderLineToPNG(line, areaW, fontSize, colorCSS);
    if (png) pngCache.set(line, png);
  }

  // ── embed each unique PNG once into the PDF ──
  const imgCache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
  for (const [line, pngBytes] of pngCache) {
    imgCache.set(line, await pdf.embedPng(pngBytes));
  }

  const lineImgH = Math.ceil(fontSize * 1.4);

  // ── build pages ──
  for (const chunk of chunks) {
    // copyPages shares fonts/images from the template — no duplication
    const [copiedPage] = await pdf.copyPages(tplDoc, [0]);
    pdf.addPage(copiedPage);

    for (let i = 0; i < chunk.length; i++) {
      const line = chunk[i];
      if (!line.trim()) continue;

      const img = imgCache.get(line);
      if (!img) continue;

      const y = H - topMargin - (i + 1) * spacing;

      copiedPage.drawImage(img, {
        x:      leftMargin,
        y,
        width:  areaW,
        height: lineImgH,
      });
    }
  }

  return pdf.save();
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
