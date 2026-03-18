import type { SlidePlan } from './geminiAgent';
import type { LessonFormData } from '../App';

const THEMES: Record<string, Record<string, string>> = {
  classic: {
    '--bg-slide': '#f8f4ef',
    '--bg-primary': '#1a4731',
    '--bg-secondary': '#2a6b4a',
    '--text-on-primary': '#fef9f0',
    '--text-body': '#1a2e1a',
    '--text-muted': '#4a6b4a',
    '--accent': '#d4a017',
    '--accent-light': '#fef3c7',
    '--border': '#c8d5c0',
    '--slide-bg': '#fdf8f3',
    '--card-bg': '#ffffff',
    '--quran-bg': '#1a4731',
    '--quran-text': '#fef9f0',
    '--tag-bg': '#e8f5e9',
    '--tag-text': '#1a4731',
  },
  default: {
    '--bg-slide': '#f8fafc',
    '--bg-primary': '#0284c7',
    '--bg-secondary': '#0ea5e9',
    '--text-on-primary': '#ffffff',
    '--text-body': '#0f172a',
    '--text-muted': '#64748b',
    '--accent': '#f59e0b',
    '--accent-light': '#fef3c7',
    '--border': '#e2e8f0',
    '--slide-bg': '#f8fafc',
    '--card-bg': '#ffffff',
    '--quran-bg': '#0b4f78',
    '--quran-text': '#ffffff',
    '--tag-bg': '#e0f2fe',
    '--tag-text': '#0284c7',
  },
  dark: {
    '--bg-slide': '#0f172a',
    '--bg-primary': '#1e3a5f',
    '--bg-secondary': '#1e40af',
    '--text-on-primary': '#e2e8f0',
    '--text-body': '#e2e8f0',
    '--text-muted': '#94a3b8',
    '--accent': '#f59e0b',
    '--accent-light': '#2d1f00',
    '--border': '#334155',
    '--slide-bg': '#0f172a',
    '--card-bg': '#1e293b',
    '--quran-bg': '#0c1a33',
    '--quran-text': '#e2e8f0',
    '--tag-bg': '#1e293b',
    '--tag-text': '#94a3b8',
  },
  vibrant: {
    '--bg-slide': '#fdf4ff',
    '--bg-primary': '#7c3aed',
    '--bg-secondary': '#a855f7',
    '--text-on-primary': '#ffffff',
    '--text-body': '#3b0764',
    '--text-muted': '#7e22ce',
    '--accent': '#f59e0b',
    '--accent-light': '#fef3c7',
    '--border': '#e9d5ff',
    '--slide-bg': '#fdf4ff',
    '--card-bg': '#ffffff',
    '--quran-bg': '#4c1d95',
    '--quran-text': '#ede9fe',
    '--tag-bg': '#ede9fe',
    '--tag-text': '#6d28d9',
  },
};

const SLIDE_TYPE_ICONS: Record<string, string> = {
  intro: '🌟',
  verse: '📖',
  vocabulary: '📚',
  insight: '💡',
  story: '✨',
  question: '🤔',
  review: '📋',
  closing: '🤲',
};

const SLIDE_TYPE_LABELS: Record<string, string> = {
  intro: 'Introduction',
  verse: 'Holy Quran',
  vocabulary: 'Vocabulary',
  insight: 'Lesson & Benefit',
  story: 'Story / Hadith',
  question: 'Reflection',
  review: 'Review',
  closing: 'Closing',
};

function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSlideContent(slide: SlidePlan): string {
  const type = slide.type || 'insight';
  const icon = SLIDE_TYPE_ICONS[type] || '📝';
  const label = SLIDE_TYPE_LABELS[type] || type;
  const title = escapeHtml(slide.title || slide.topic);
  const interactive = escapeHtml(slide.interactive_element || '');

  // For verse slides, identify Arabic text (lines starting with Arabic chars) and separate
  let contentHtml = '';

  if (type === 'verse') {
    // Split into paragraphs and try to detect Arabic vs English lines
    const lines = (slide.core_content || '').split('\n').filter(l => l.trim());
    contentHtml = lines.map(line => {
      const isAr = /^[\u0600-\u06FF]/.test(line.trim());
      if (isAr) {
        return `<p class="arabic-text" dir="rtl">${escapeHtml(line)}</p>`;
      }
      return `<p class="translation-text">${escapeHtml(line)}</p>`;
    }).join('');
  } else if (type === 'vocabulary') {
    // Each line as a vocab card
    const lines = (slide.core_content || '').split('\n').filter(l => l.trim());
    contentHtml = `<div class="vocab-grid">${lines.map(line => {
      const isAr = /[\u0600-\u06FF]/.test(line);
      return `<div class="vocab-card"><p ${isAr ? 'dir="rtl" class="vocab-arabic"' : ''}>${escapeHtml(line)}</p></div>`;
    }).join('')}</div>`;
  } else {
    // Standard — split by line breaks, detect Arabic paragraphs
    const lines = (slide.core_content || '').split('\n').filter(l => l.trim());
    contentHtml = lines.map(line => {
      const isAr = /^[\u0600-\u06FF]/.test(line.trim());
      if (isAr) {
        return `<p class="slide-text arabic-inline" dir="rtl">${escapeHtml(line)}</p>`;
      }
      return `<p class="slide-text">${escapeHtml(line)}</p>`;
    }).join('');
  }

  const interactiveHtml = interactive ? `
    <div class="interactive-box">
      <span class="interactive-label">💬 Reflect</span>
      <p>${interactive}</p>
    </div>` : '';

  return `
    <div class="slide-header">
      <span class="slide-type-tag">${icon} ${label}</span>
    </div>
    <div class="slide-body">
      <h2 class="slide-title">${title}</h2>
      <div class="slide-content ${type === 'verse' ? 'verse-content' : ''}">${contentHtml}</div>
      ${interactiveHtml}
    </div>
  `;
}

export function buildHtmlPresentation(slides: SlidePlan[], formData: LessonFormData, summary: string): string {
  const themeKey = formData.theme || 'classic';
  const themeVars = THEMES[themeKey] || THEMES['classic'];
  const cssVarsStr = Object.entries(themeVars).map(([k, v]) => `${k}: ${v};`).join('\n    ');
  const totalSlides = slides.length;

  const slidesHtml = slides.map((slide, idx) => {
    const type = slide.type || 'insight';
    const isSpecialType = ['verse', 'intro', 'closing'].includes(type);
    return `
  <!-- SLIDE ${idx + 1} | Type: ${type} | Objective: ${escapeHtml(slide.objective)} -->
  <section class="slide slide-type-${type}" data-index="${idx}">
    <div class="slide-inner ${isSpecialType ? 'slide-featured' : ''}">
      ${renderSlideContent(slide)}
    </div>
  </section>`}).join('\n');

  const lessonSummaryHtml = escapeHtml(summary).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tafsir Lesson — ${escapeHtml(formData.surahName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      ${cssVarsStr}
      --font-arabic: 'Amiri', 'Noto Naskh Arabic', serif;
      --font-ui: 'Inter', system-ui, sans-serif;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-ui);
      background: var(--slide-bg);
      overflow: hidden;
      height: 100vh;
      width: 100vw;
      color: var(--text-body);
    }

    /* ---- Slide Container ---- */
    .presentation {
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }

    .slide {
      position: absolute;
      inset: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem 5rem;
      background: var(--slide-bg);
      opacity: 0;
      transform: translateX(100%);
      transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }

    .slide.active {
      opacity: 1;
      transform: translateX(0);
      pointer-events: all;
    }

    .slide.prev-slide {
      opacity: 0;
      transform: translateX(-100%);
    }

    /* ---- Featured slides (intro / verse / closing) ---- */
    .slide-type-intro, .slide-type-closing {
      background: linear-gradient(135deg, var(--bg-primary), var(--bg-secondary));
      color: var(--text-on-primary);
    }
    .slide-type-intro .slide-title,
    .slide-type-closing .slide-title { color: var(--text-on-primary); }
    .slide-type-intro .slide-text,
    .slide-type-closing .slide-text { color: var(--text-on-primary); opacity: 0.9; }
    .slide-type-intro .slide-type-tag,
    .slide-type-closing .slide-type-tag { background: rgba(255,255,255,0.2); color: var(--text-on-primary); }

    .slide-type-verse {
      background: var(--slide-bg);
    }
    .slide-type-verse .slide-inner {
      border-top: 4px solid var(--accent);
    }

    .slide-type-question {
      background: var(--accent-light);
    }
    .slide-type-question .slide-type-tag {
      background: var(--accent);
      color: #fff;
    }

    /* ---- Inner layout ---- */
    .slide-inner {
      background: var(--card-bg);
      border-radius: 1.5rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.12);
      padding: 3rem 3.5rem;
      width: 100%;
      max-width: 820px;
      max-height: calc(100vh - 9rem);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .slide-type-intro .slide-inner,
    .slide-type-closing .slide-inner {
      background: transparent;
      box-shadow: none;
      text-align: center;
      align-items: center;
    }

    /* ---- Slide Header ---- */
    .slide-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .slide-type-tag {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--tag-text);
      background: var(--tag-bg);
      padding: 0.35rem 0.9rem;
      border-radius: 100px;
    }

    /* ---- Slide Body ---- */
    .slide-body { display: flex; flex-direction: column; gap: 1.25rem; }

    .slide-title {
      font-size: clamp(1.5rem, 3vw, 2.2rem);
      font-weight: 700;
      color: var(--text-body);
      line-height: 1.25;
    }

    .slide-text {
      font-size: clamp(1rem, 1.5vw, 1.15rem);
      color: var(--text-body);
      line-height: 1.75;
    }

    /* ---- Arabic Text Styles ---- */
    .arabic-text {
      font-family: var(--font-arabic);
      font-size: clamp(1.6rem, 3vw, 2.4rem);
      line-height: 2.2;
      text-align: center;
      background: var(--quran-bg);
      color: var(--quran-text);
      padding: 1.5rem 2rem;
      border-radius: 1rem;
      margin: 0.5rem 0;
      direction: rtl;
    }

    .translation-text {
      font-size: 1rem;
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
      line-height: 1.75;
    }

    .arabic-inline {
      font-family: var(--font-arabic);
      font-size: 1.3rem;
      line-height: 2;
      color: var(--bg-primary);
    }

    /* ---- Vocabulary ---- */
    .vocab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .vocab-card {
      background: var(--tag-bg);
      border-radius: 0.75rem;
      padding: 0.85rem 1rem;
    }

    .vocab-arabic {
      font-family: var(--font-arabic);
      font-size: 1.3rem;
      line-height: 1.75;
    }

    /* ---- Interactive Box ---- */
    .interactive-box {
      border-left: 4px solid var(--accent);
      background: var(--accent-light);
      border-radius: 0 0.75rem 0.75rem 0;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .interactive-label {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
    }

    /* ---- Progress bar ---- */
    #progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 4px;
      background: linear-gradient(to right, var(--bg-primary), var(--accent));
      transition: width 0.4s ease;
      z-index: 100;
    }

    /* ---- Controls ---- */
    .controls {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 1.25rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      padding: 0.6rem 1.25rem;
      border-radius: 100px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      z-index: 100;
    }

    .controls button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.4rem 0.75rem;
      border-radius: 0.4rem;
      font-size: 1.1rem;
      color: var(--text-body);
      transition: background 0.2s;
      display: flex;
      align-items: center;
    }

    .controls button:hover { background: var(--border); }
    .controls button:disabled { opacity: 0.3; cursor: default; }

    #slide-counter {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-muted);
      min-width: 80px;
      text-align: center;
    }

    /* Scrollbar */
    .slide-inner::-webkit-scrollbar { width: 4px; }
    .slide-inner::-webkit-scrollbar-track { background: transparent; }
    .slide-inner::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

    /* Summary modal */
    #summary-modal {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
    }

    #summary-modal.hidden { display: none; }

    .modal-inner {
      background: var(--card-bg);
      border-radius: 1.5rem;
      padding: 2.5rem;
      max-width: 580px;
      width: 90%;
      box-shadow: 0 30px 80px rgba(0,0,0,0.3);
    }

    .modal-inner h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: var(--text-body);
    }

    .modal-inner p { color: var(--text-muted); line-height: 1.7; margin-bottom: 1.5rem; }

    .modal-inner button {
      background: var(--bg-primary);
      color: var(--text-on-primary);
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    @media (max-width: 640px) {
      .slide-inner { padding: 2rem 1.5rem; }
      .slide-title { font-size: 1.4rem; }
      .arabic-text { font-size: 1.4rem; }
    }
  </style>
</head>
<body>

<div id="progress-bar"></div>

<!-- Summary Modal -->
<div id="summary-modal">
  <div class="modal-inner">
    <h2>📖 Lesson Ready</h2>
    <p>${lessonSummaryHtml}</p>
    <button onclick="document.getElementById('summary-modal').classList.add('hidden')">Begin Lesson →</button>
  </div>
</div>

<div class="presentation" id="presentation">
  ${slidesHtml}
</div>

<div class="controls">
  <button id="btn-prev" aria-label="Previous" disabled onclick="navigate(-1)">◀</button>
  <span id="slide-counter">1 / ${totalSlides}</span>
  <button id="btn-next" aria-label="Next" onclick="navigate(1)">▶</button>
</div>

<script>
  const slides = document.querySelectorAll('.slide');
  const total = slides.length;
  let current = 0;

  function updateSlides() {
    slides.forEach((s, i) => {
      s.classList.remove('active', 'prev-slide');
      if (i === current) s.classList.add('active');
      else if (i < current) s.classList.add('prev-slide');
    });
    document.getElementById('slide-counter').textContent = (current + 1) + ' / ' + total;
    document.getElementById('btn-prev').disabled = current === 0;
    document.getElementById('btn-next').disabled = current === total - 1;
    const pct = total > 1 ? (current / (total - 1)) * 100 : 100;
    document.getElementById('progress-bar').style.width = pct + '%';
  }

  function navigate(dir) {
    const next = current + dir;
    if (next >= 0 && next < total) {
      current = next;
      updateSlides();
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate(-1);
  });

  // Touch/swipe support
  let touchStartX = 0;
  document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
  });

  updateSlides();
</script>
</body>
</html>`;
}
