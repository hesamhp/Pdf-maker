import { useState, useRef, useCallback } from 'react';
import { generatePdf, downloadPdf } from './utils/pdfGenerator';
import {
  FileUp,
  FileText,
  Settings,
  Download,
  Loader2,
  Check,
  AlertCircle,
  Palette,
  Type,
  ArrowUpDown,
  ArrowLeftRight,
  Sparkles,
  X,
  BookText,
  RotateCcw,
  WandSparkles,
} from 'lucide-react';

// ── Text cleanup utility ──
function cleanupText(text: string): string {
  let result = text;

  // 1. Normalize line endings
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Remove horizontal rules / separators:  ---, ***, ___, ===, ─── etc.
  result = result.replace(/^[\s]*[-–—=_*~·•─━]{2,}[\s]*$/gm, '');

  // 3. Remove trailing whitespace from each line
  result = result.replace(/[^\S\n]+$/gm, '');

  // 4. Remove leading whitespace from each line
  result = result.replace(/^[^\S\n]+/gm, '');

  // 5. Collapse 2+ consecutive newlines into 1 (no blank lines between)
  result = result.replace(/\n{2,}/g, '\n');

  // 6. Add a blank line before any line that contains "جلسه"
  result = result.replace(/(?<!\n)\n(?=.*جلسه)/g, '\n\n');

  // 6. Collapse multiple spaces into one
  result = result.replace(/ {2,}/g, ' ');

  // 7. Remove spaces before punctuation
  result = result.replace(/ +([.،؛:؟!)\]»])/g, '$1');

  // 8. Add space after punctuation if missing (but not before newline)
  result = result.replace(/([.،؛:؟!](?!\n))(?=[^\s\d)\]».])/g, '$1 ');

  // 9. Fix Persian/Arabic half-space issues: remove spaces around ZWNJ
  result = result.replace(/ +\u200C/g, '\u200C');
  result = result.replace(/\u200C +/g, '\u200C');

  // 10. Trim leading/trailing whitespace
  result = result.trim();

  return result;
}

const SAMPLE_TEXT = `بنام خدا

این یک متن نمونه فارسی است که برای تست برنامه نوشته شده است. این برنامه قابلیت نوشتن متن روی قالب PDF از پیش طراحی شده را دارد.

This is a sample English text that demonstrates mixed language support. You can write both Persian and English text together.

ویژگی‌های این برنامه:
- پشتیبانی از زبان فارسی و عربی
- پشتیبانی از زبان انگلیسی
- امکان استفاده همزمان از هر دو زبان
- صفحه‌بندی خودکار متن
- تکرار قالب در همه صفحات
- تنظیم حاشیه‌ها برای هدر و فوتر

The PDF Template Writer application allows you to:
1. Upload a pre-designed PDF template
2. Write long text content on it
3. Automatically paginate across multiple pages
4. Support for RTL (Right-to-Left) languages

لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ و با استفاده از طراحان گرافیک است. چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است و برای شرایط فعلی تکنولوژی مورد نیاز و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد.`;

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [templateFile, setTemplateFile] = useState<ArrayBuffer | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('output');
  const [topMargin, setTopMargin] = useState<number>(100);
  const [bottomMargin, setBottomMargin] = useState<number>(90);
  const [leftMargin, setLeftMargin] = useState<number>(50);
  const [rightMargin, setRightMargin] = useState<number>(50);
  const [fontSize, setFontSize] = useState<number>(16);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [textColor, setTextColor] = useState({ r: 33, g: 33, b: 33 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'settings'>('content');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      addToast('لطفاً فقط فایل PDF انتخاب کنید', 'error');
      return;
    }
    const buffer = await file.arrayBuffer();
    setTemplateFile(buffer);
    setTemplateName(file.name);
    addToast(`قالب «${file.name}» با موفقیت بارگذاری شد`, 'success');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleGenerate = async () => {
    if (!templateFile) {
      addToast('لطفاً ابتدا یک قالب PDF انتخاب کنید', 'error');
      return;
    }
    if (!content.trim()) {
      addToast('لطفاً متن مورد نظر را وارد کنید', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const pdfBytes = await generatePdf({
        templateFile,
        content,
        fileName,
        topMargin,
        bottomMargin,
        leftMargin,
        rightMargin,
        fontSize,
        lineHeight,
        textColor,
      });
      downloadPdf(pdfBytes, fileName);
      addToast('فایل PDF با موفقیت ساخته و دانلود شد! 🎉', 'success');
    } catch (error) {
      console.error('PDF generation error:', error);
      addToast(`خطا در ساخت PDF: ${(error as Error).message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setTextColor({ r, g, b });
  };

  const colorHex = `#${textColor.r.toString(16).padStart(2, '0')}${textColor.g.toString(16).padStart(2, '0')}${textColor.b.toString(16).padStart(2, '0')}`;

  const canGenerate = templateFile && content.trim();

  return (
    <div className="min-h-screen relative overflow-hidden" dir="rtl">
      {/* Floating orbs */}
      <div className="floating-orb orb-1" />
      <div className="floating-orb orb-2" />
      <div className="floating-orb orb-3" />

      {/* Toasts */}
      <div className="fixed top-6 left-6 z-50 flex flex-col gap-3" dir="rtl">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast-enter glass-strong rounded-2xl px-5 py-3.5 flex items-center gap-3 min-w-[300px] max-w-[420px]
              ${toast.type === 'success' ? 'border-green-500/30' : ''}
              ${toast.type === 'error' ? 'border-red-500/30' : ''}
              ${toast.type === 'info' ? 'border-blue-500/30' : ''}
            `}
          >
            {toast.type === 'success' && <Check className="w-5 h-5 text-green-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />}
            <span className="text-white/90 text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 glass rounded-full px-6 py-3 mb-6">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <span className="text-white/60 text-sm font-medium tracking-wide">PDF Template Writer</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
            نوشتن متن روی قالب
            <span className="bg-gradient-to-l from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent"> PDF</span>
          </h1>
          <p className="text-white/45 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            قالب PDF خود را بارگذاری کنید، متن فارسی یا انگلیسی وارد کنید
            <br className="hidden sm:block" />
            و خروجی حرفه‌ای با صفحه‌بندی خودکار دریافت کنید
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Template Upload */}
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                  <FileUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-base">قالب PDF</h2>
                  <p className="text-white/35 text-xs">فایل PDF قالب خود را انتخاب کنید</p>
                </div>
              </div>

              <div
                className={`file-drop-zone rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-300
                  ${isDragOver ? 'drag-over scale-[1.02]' : ''} 
                  ${templateFile ? 'border-green-500/30 bg-green-500/5' : ''}
                `}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />

                {templateFile ? (
                  <div className="space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto">
                      <Check className="w-7 h-7 text-green-400" />
                    </div>
                    <p className="text-green-400 font-medium text-sm truncate max-w-[200px] mx-auto">{templateName}</p>
                    <p className="text-white/35 text-xs">برای تغییر کلیک کنید</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto pulse-glow">
                      <FileUp className="w-7 h-7 text-white/30" />
                    </div>
                    <p className="text-white/60 font-medium text-sm">فایل PDF را اینجا بکشید</p>
                    <p className="text-white/30 text-xs">یا کلیک کنید برای انتخاب</p>
                  </div>
                )}
              </div>
            </div>

            {/* File Name */}
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-white font-semibold text-base">نام فایل خروجی</h2>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  placeholder="نام فایل..."
                  className="glass-input w-full rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm"
                  dir="ltr"
                />
                <span className="text-white/30 text-sm font-mono select-none">.pdf</span>
              </div>
            </div>

            {/* Status indicators */}
            <div className="glass rounded-3xl p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${templateFile ? 'bg-green-400' : 'bg-white/20'}`} />
                  <span className={`text-sm ${templateFile ? 'text-green-400' : 'text-white/30'}`}>
                    {templateFile ? 'قالب بارگذاری شده' : 'قالب بارگذاری نشده'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${content.trim() ? 'bg-green-400' : 'bg-white/20'}`} />
                  <span className={`text-sm ${content.trim() ? 'text-green-400' : 'text-white/30'}`}>
                    {content.trim() ? `${content.length} کاراکتر وارد شده` : 'متن وارد نشده'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${fileName.trim() ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <span className={`text-sm ${fileName.trim() ? 'text-green-400' : 'text-yellow-400'}`}>
                    {fileName.trim() ? `${fileName}.pdf` : 'نام فایل خالی'}
                  </span>
                </div>
              </div>
            </div>

            {/* Generate Button (Desktop) */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={`hidden lg:flex glass-button-green rounded-2xl px-6 py-4 items-center justify-center gap-3 text-white font-semibold text-base w-full
                ${(isGenerating || !canGenerate) ? 'opacity-40 cursor-not-allowed !transform-none' : ''}
              `}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>در حال ساخت...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>ساخت و دانلود PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Tabs */}
            <div className="glass rounded-2xl p-1.5 flex gap-1">
              <button
                onClick={() => setActiveTab('content')}
                className={`flex-1 rounded-xl py-3 px-4 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2
                  ${activeTab === 'content'
                    ? 'bg-white/15 text-white shadow-lg'
                    : 'text-white/40 hover:text-white/60'
                  }`}
              >
                <Type className="w-4 h-4" />
                محتوای متن
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 rounded-xl py-3 px-4 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2
                  ${activeTab === 'settings'
                    ? 'bg-white/15 text-white shadow-lg'
                    : 'text-white/40 hover:text-white/60'
                  }`}
              >
                <Settings className="w-4 h-4" />
                تنظیمات
              </button>
            </div>

            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="glass rounded-3xl p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/30 to-teal-500/30 flex items-center justify-center">
                      <Type className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-semibold text-base">متن</h2>
                      <p className="text-white/35 text-xs">فارسی + انگلیسی مخلوط</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setContent(SAMPLE_TEXT)}
                      className="glass-button-secondary rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white flex items-center gap-1.5"
                      title="درج متن نمونه"
                    >
                      <BookText className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">متن نمونه</span>
                    </button>
                    {content && (
                      <>
                        <button
                          onClick={() => {
                            const cleaned = cleanupText(content);
                            if (cleaned !== content) {
                              setContent(cleaned);
                              addToast('متن مرتب شد ✨', 'success');
                            } else {
                              addToast('متن از قبل مرتب است', 'info');
                            }
                          }}
                          className="glass-button-secondary rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-purple-400 flex items-center gap-1.5"
                          title="مرتب‌سازی متن: حذف اینترهای اضافی، فاصله‌های زیاد و تمیزکاری"
                        >
                          <WandSparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">مرتب‌سازی</span>
                        </button>
                        <button
                          onClick={() => setContent('')}
                          className="glass-button-secondary rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-red-400 flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">پاک کردن</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={`متن مورد نظر خود را اینجا وارد کنید...\n\nمی‌توانید از متن فارسی و English به صورت مخلوط استفاده کنید.\n\nهر چقدر متن طولانی باشد، صفحات بیشتری ساخته می‌شود\nو قالب در همه صفحات تکرار می‌شود.`}
                  className="glass-input w-full rounded-2xl px-5 py-4 text-white placeholder-white/20 text-sm leading-loose"
                  dir="rtl"
                  style={{ minHeight: '420px', fontFamily: "'Vazirmatn', sans-serif" }}
                />

                <div className="flex items-center justify-between mt-3 text-white/25 text-xs">
                  <div className="flex items-center gap-4">
                    <span>{content.length.toLocaleString('fa-IR')} کاراکتر</span>
                    <span>{content.split('\n').length.toLocaleString('fa-IR')} خط</span>
                    <span>{content.split(/\s+/).filter(Boolean).length.toLocaleString('fa-IR')} کلمه</span>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="glass rounded-3xl p-6 space-y-8">
                {/* Margins */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/30 to-red-500/30 flex items-center justify-center">
                        <ArrowUpDown className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-base">حاشیه‌ها</h3>
                        <p className="text-white/35 text-xs">فاصله از لبه‌ها برای هدر و فوتر (pt)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setTopMargin(80);
                        setBottomMargin(80);
                        setLeftMargin(50);
                        setRightMargin(50);
                      }}
                      className="glass-button-secondary rounded-lg px-3 py-1.5 text-xs text-white/40 hover:text-white flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      پیش‌فرض
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MarginSlider label="بالا (هدر)" value={topMargin} min={20} max={200} color="blue" onChange={setTopMargin} />
                    <MarginSlider label="پایین (فوتر)" value={bottomMargin} min={20} max={200} color="blue" onChange={setBottomMargin} />
                    <MarginSlider label="چپ" value={leftMargin} min={20} max={150} color="purple" onChange={setLeftMargin} />
                    <MarginSlider label="راست" value={rightMargin} min={20} max={150} color="purple" onChange={setRightMargin} />
                  </div>

                  {/* Visual Preview */}
                  <div className="mt-6 flex justify-center">
                    <div className="relative w-36 h-48 glass-input rounded-lg overflow-hidden">
                      <div
                        className="absolute top-0 left-0 right-0 bg-blue-500/15 border-b border-blue-500/30 flex items-end justify-center"
                        style={{ height: `${Math.min((topMargin / 200) * 40, 40)}%` }}
                      >
                        <span className="text-blue-400/50 text-[7px] mb-0.5">هدر</span>
                      </div>
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-blue-500/15 border-t border-blue-500/30 flex items-start justify-center"
                        style={{ height: `${Math.min((bottomMargin / 200) * 40, 40)}%` }}
                      >
                        <span className="text-blue-400/50 text-[7px] mt-0.5">فوتر</span>
                      </div>
                      <div
                        className="absolute top-0 bottom-0 left-0 bg-purple-500/10 border-r border-purple-500/20"
                        style={{ width: `${Math.min((leftMargin / 150) * 25, 25)}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 right-0 bg-purple-500/10 border-l border-purple-500/20"
                        style={{ width: `${Math.min((rightMargin / 150) * 25, 25)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white/15 text-[7px]">ناحیه متن</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5" />

                {/* Typography */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/30 to-rose-500/30 flex items-center justify-center">
                      <ArrowLeftRight className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-base">تایپوگرافی</h3>
                      <p className="text-white/35 text-xs">اندازه فونت و فاصله خطوط</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-input rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-white/60 text-xs">اندازه فونت</label>
                        <span className="text-green-400 font-mono text-xs font-bold">{fontSize}pt</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="24"
                        step="0.5"
                        value={fontSize}
                        onChange={e => setFontSize(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="glass-input rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-white/60 text-xs">فاصله خطوط</label>
                        <span className="text-green-400 font-mono text-xs font-bold">{lineHeight.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        value={lineHeight}
                        onChange={e => setLineHeight(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5" />

                {/* Text Color */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-white font-semibold text-base">رنگ متن</h3>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="relative cursor-pointer">
                      <input
                        type="color"
                        value={colorHex}
                        onChange={handleColorChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div
                        className="w-12 h-12 rounded-xl border-2 border-white/20 shadow-lg"
                        style={{ backgroundColor: colorHex }}
                      />
                    </label>
                    <div className="glass-input rounded-xl px-4 py-3">
                      <span className="text-white/50 text-xs font-mono" dir="ltr">{colorHex.toUpperCase()}</span>
                    </div>
                    <div className="flex gap-2">
                      {['#212121', '#1a237e', '#b71c1c', '#1b5e20', '#4a148c'].map(c => (
                        <button
                          key={c}
                          onClick={() => {
                            const r = parseInt(c.slice(1, 3), 16);
                            const g = parseInt(c.slice(3, 5), 16);
                            const b = parseInt(c.slice(5, 7), 16);
                            setTextColor({ r, g, b });
                          }}
                          className="w-8 h-8 rounded-lg border border-white/10 hover:border-white/30 transition-all hover:scale-110"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 glass-input rounded-xl px-4 py-3" style={{ color: colorHex }}>
                    <span className="text-sm" style={{ fontFamily: "'Vazirmatn', sans-serif" }}>
                      نمونه متن فارسی — Sample English Text
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Generate */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={`lg:hidden glass-button-green rounded-2xl px-6 py-4 flex items-center justify-center gap-3 text-white font-semibold text-base w-full
                ${(isGenerating || !canGenerate) ? 'opacity-40 cursor-not-allowed !transform-none' : ''}
              `}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>در حال ساخت...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>ساخت و دانلود PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 glass rounded-3xl p-8">
          <h3 className="text-white font-semibold text-lg mb-8 text-center">
            ✨ ویژگی‌ها
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <FeatureCard
              emoji="🌐"
              title="دو زبانه"
              description="پشتیبانی از فارسی، عربی و انگلیسی به صورت مخلوط در یک متن"
              gradient="from-blue-500/20 to-cyan-500/20"
            />
            <FeatureCard
              emoji="📄"
              title="صفحات نامحدود"
              description="قالب در تمام صفحات تکرار و متن خودکار صفحه‌بندی می‌شود"
              gradient="from-purple-500/20 to-pink-500/20"
            />
            <FeatureCard
              emoji="📐"
              title="حاشیه‌های قابل تنظیم"
              description="کنترل کامل حاشیه بالا و پایین برای هدر و فوتر قالب"
              gradient="from-orange-500/20 to-red-500/20"
            />
            <FeatureCard
              emoji="🎨"
              title="سفارشی‌سازی"
              description="تنظیم اندازه فونت، فاصله خطوط و رنگ متن دلخواه"
              gradient="from-green-500/20 to-teal-500/20"
            />
          </div>
        </div>

        <footer className="mt-8 text-center text-white/15 text-xs pb-6">
          طراحی و توسعه توسط HESAM
        </footer>
      </div>
    </div>
  );
}

// ==========================================
// Sub-components
// ==========================================

function MarginSlider({
  label,
  value,
  min,
  max,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  color: 'blue' | 'purple';
  onChange: (v: number) => void;
}) {
  const colorClass = color === 'blue' ? 'text-blue-400' : 'text-purple-400';
  return (
    <div className="glass-input rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <label className="text-white/60 text-xs">{label}</label>
        <span className={`${colorClass} font-mono text-xs font-bold`}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function FeatureCard({
  emoji,
  title,
  description,
  gradient,
}: {
  emoji: string;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="text-center space-y-3">
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto`}>
        <span className="text-2xl">{emoji}</span>
      </div>
      <h4 className="text-white/85 font-medium text-sm">{title}</h4>
      <p className="text-white/35 text-xs leading-relaxed">{description}</p>
    </div>
  );
}
