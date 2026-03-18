import React, { useState, useEffect } from 'react';
import {
  BookOpen, Settings, Play, Download,
  Eye, ChevronDown, ChevronUp, CheckCircle, Loader2, AlertCircle, X
} from 'lucide-react';
import './index.css';
import { generateLessonWorkflow } from './services/geminiAgent';
import type { SlidePlan, ProgressCallback } from './services/geminiAgent';
import { buildHtmlPresentation } from './services/htmlBuilder';

export interface LessonFormData {
  surahName: string;
  verseRange: string;
  lessonPurpose: string;
  ageGroup: string;
  languageBackground: string;
  academicLevel: string;
  deliveryLanguage: string;
  languageComplexity: string;
  tone: string;
  sections: Record<string, boolean>;
  theme: string;
  slideDensity: string;
  slideCount: string;
  specialInstructions: string;
  apiKey: string;
}

const defaultFormData: LessonFormData = {
  surahName: '',
  verseRange: '',
  lessonPurpose: 'First-time introduction',
  ageGroup: 'Children (9–12)',
  languageBackground: 'Non-Arab — beginner Arabic',
  academicLevel: 'Basic',
  deliveryLanguage: 'Bilingual (English primary + Arabic support)',
  languageComplexity: 'Simple',
  tone: 'Warm and encouraging',
  sections: {
    surahIntro: true, nameMeaning: true, classification: false, theme: true,
    asbab: false, tafsir: true, vocabulary: true, linguistics: false,
    fawaid: true, behavioral: true, contemporary: false, hadith: false,
    questions: false, quiz: false, dua: true,
  },
  theme: 'classic',
  slideDensity: 'Standard',
  slideCount: 'Medium (15–20 slides)',
  specialInstructions: '',
  apiKey: '',
};

type GenStage = 'idle' | 'planning' | 'generating' | 'assembling' | 'complete' | 'error';

interface StageInfo {
  label: string;
  description: string;
  icon: string;
}

const STAGES: Record<string, StageInfo> = {
  planning:  { label: 'Stage 1 — Architecting',     description: 'Designing the lesson structure and slide flow...', icon: '🏗️' },
  generating: { label: 'Stage 2 — Gathering Content', description: 'Researching Tafsir and generating slide content...', icon: '📚' },
  assembling: { label: 'Stage 3 — Building Slides',  description: 'Applying theme and assembling the HTML presentation...', icon: '🎨' },
};

const SECTION_LABELS: Record<string, string> = {
  surahIntro: 'Surah Introduction & Hook',
  nameMeaning: 'Name Meaning & Etymology',
  classification: 'Meccan / Madinan Classification',
  theme: 'General Theme & Purpose',
  asbab: 'Causes of Revelation (Asbab al-Nuzul)',
  tafsir: 'Verse-by-verse Tafsir ⭐',
  vocabulary: 'Vocabulary & Word Meanings',
  linguistics: 'Linguistic & Rhetorical Features (Advanced)',
  fawaid: 'Lessons & Benefits — Fawa\'id',
  behavioral: 'Behavioral & Daily Life Applications',
  contemporary: 'Connection to Contemporary Reality',
  hadith: 'Supporting Hadith & Prophetic Stories',
  questions: 'Interactive Comprehension Questions',
  quiz: 'Final Review Quiz',
  dua: 'Closing Reflection & Du\'a',
};

function CollapsibleSection({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button className="collapsible-header" onClick={() => setOpen(o => !o)}>
        <h2 className="card-title" style={{ margin: 0 }}>{icon} {title}</h2>
        {open ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function App() {
  const [formData, setFormData] = useState<LessonFormData>(() => {
    try { return { ...defaultFormData, ...JSON.parse(localStorage.getItem('tafsirBuilderData') || '{}') }; }
    catch { return defaultFormData; }
  });
  const [genStage, setGenStage] = useState<GenStage>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [resultSlides, setResultSlides] = useState<SlidePlan[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('tafsirBuilderData', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', formData.theme);
  }, [formData.theme]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, sections: { ...prev.sections, [name]: checked } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleGenerate = async () => {
    if (!formData.apiKey.trim()) { setShowSettings(true); return; }
    if (!formData.surahName.trim()) { alert('Please enter a Surah name.'); return; }

    setGenStage('planning');
    setProgressMsg(STAGES.planning.description);
    setErrorMsg('');

    const onProgress: ProgressCallback = (stage, message) => {
      setGenStage(stage);
      setProgressMsg(message);
    };

    try {
      const outline = await generateLessonWorkflow(formData, onProgress);
      setResultSlides(outline);
      setGenStage('assembling');
      setProgressMsg(STAGES.assembling.description);

      // Build lesson summary
      const enabledSections = Object.entries(formData.sections)
        .filter(([, v]) => v)
        .map(([k]) => SECTION_LABELS[k] || k)
        .join(', ');

      const summary = [
        `📖 Surah: ${formData.surahName}${formData.verseRange ? ` (${formData.verseRange})` : ' (Full)'}`,
        `👤 Students: ${formData.ageGroup} · ${formData.academicLevel}`,
        `🌍 Language: ${formData.deliveryLanguage} · Tone: ${formData.tone}`,
        `📚 Sections: ${enabledSections}`,
        `🖼️ Total Slides: ${outline.length}`,
        `🎨 Theme: ${formData.theme === 'classic' ? 'Classic Islamic' : formData.theme.charAt(0).toUpperCase() + formData.theme.slice(1)}`,
      ].join('\n');

      // Short artificial delay to show assembling step
      await new Promise(r => setTimeout(r, 600));

      const html = buildHtmlPresentation(outline, formData, summary);
      setGeneratedHtml(html);
      setGenStage('complete');
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An unknown error occurred during generation.');
      setGenStage('error');
    }
  };

  const downloadHtml = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tafsir_${formData.surahName.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const previewHtml = () => {
    if (!generatedHtml) return;
    const win = window.open();
    win?.document.write(generatedHtml);
    win?.document.close();
  };

  const resetApp = () => {
    setGenStage('idle');
    setGeneratedHtml(null);
    setResultSlides([]);
    setErrorMsg('');
  };

  return (
    <div className="container" dir="ltr">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="brand-name">Tafsir Lesson Builder</h1>
            <p className="brand-sub">AI-powered Quran lesson generator</p>
          </div>
        </div>
        <button className="settings-btn" onClick={() => setShowSettings(s => !s)} aria-label="Settings">
          <Settings size={20} />
          API Key
        </button>
      </header>

      {/* API Key Panel */}
      {showSettings && (
        <div className="card settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>⚙️ Settings</h2>
            <button onClick={() => setShowSettings(false)} className="icon-btn"><X size={18} /></button>
          </div>
          <div className="form-group">
            <label>Gemini API Key <span className="hint">(saved in your browser only)</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                name="apiKey"
                value={formData.apiKey}
                onChange={handleChange}
                placeholder="Enter your Gemini API Key (AIza...)"
                spellCheck={false}
              />
              <button
                onClick={() => setShowApiKey(v => !v)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <Eye size={16} />
              </button>
            </div>
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              Get your free API key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">aistudio.google.com</a>
            </p>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* FORM — shown only when idle */}
      {/* ============================================================= */}
      {genStage === 'idle' && (
        <>
          <CollapsibleSection title="Lesson Scope" icon="📖" defaultOpen>
            <div className="grid-2">
              <div className="form-group">
                <label>Surah Name</label>
                <input type="text" name="surahName" value={formData.surahName} onChange={handleChange} placeholder="e.g., Al-Fatihah, Al-Kahf, Yasin" />
              </div>
              <div className="form-group">
                <label>Verse Range <span className="hint">(optional)</span></label>
                <input type="text" name="verseRange" value={formData.verseRange} onChange={handleChange} placeholder="e.g., Full Surah / Verses 1–7" />
              </div>
            </div>
            <div className="form-group">
              <label>Lesson Purpose</label>
              <select name="lessonPurpose" value={formData.lessonPurpose} onChange={handleChange}>
                {['First-time introduction','Review & deepening','Memorization support','Behavioral focus','Exam preparation','General'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Student Profile" icon="👤" defaultOpen>
            <div className="grid-2">
              <div className="form-group">
                <label>Age Group</label>
                <select name="ageGroup" value={formData.ageGroup} onChange={handleChange}>
                  {['Young children (5–8)','Children (9–12)','Teenagers (13–17)','Young adults (18–25)','Adults (26+)','Mixed / General audience'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Language Background</label>
                <select name="languageBackground" value={formData.languageBackground} onChange={handleChange}>
                  {['Native Arabic speaker','Heritage Arabic speaker (non-native but familiar)','Non-Arab — beginner Arabic','Non-Arab — intermediate Arabic','Non-Arab — advanced Arabic','Non-Arab — no Arabic (needs full translation)'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Academic / Religious Level</label>
                <select name="academicLevel" value={formData.academicLevel} onChange={handleChange}>
                  {['Complete beginner (no prior Quran study)','Basic (knows letters and short surahs)','Intermediate (memorized juz and knows some tafsir)','Advanced (serious student of Quran sciences)'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Language & Delivery" icon="🌍" defaultOpen>
            <div className="grid-2">
              <div className="form-group">
                <label>Delivery Language</label>
                <select name="deliveryLanguage" value={formData.deliveryLanguage} onChange={handleChange}>
                  {['Arabic only','English only','Bilingual (Arabic primary + English support)','Bilingual (English primary + Arabic support)'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Language Complexity</label>
                <select name="languageComplexity" value={formData.languageComplexity} onChange={handleChange}>
                  {['Very simple','Simple','Moderate','Formal/Academic'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tone</label>
                <select name="tone" value={formData.tone} onChange={handleChange}>
                  {['Warm and encouraging','Engaging and youthful','Reflective and mature','Scholarly and precise'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Lesson Sections to Include" icon="📚" defaultOpen>
            <div className="sections-grid">
              {Object.entries(SECTION_LABELS).map(([key, label]) => (
                <label key={key} className="section-checkbox">
                  <input type="checkbox" name={key} checked={!!formData.sections[key]} onChange={handleChange} />
                  <span className="checkbox-custom" />
                  {label}
                </label>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Design Preferences" icon="🎨" defaultOpen>
            <div className="theme-grid">
              {(['classic','default','dark','vibrant'] as const).map(t => (
                <label key={t} className={`theme-option ${formData.theme === t ? 'selected' : ''}`}>
                  <input type="radio" name="theme" value={t} checked={formData.theme === t} onChange={handleChange} />
                  <div className={`theme-preview theme-${t}`} />
                  <span>{t === 'default' ? 'Modern Minimal' : t === 'classic' ? 'Classic Islamic' : t === 'dark' ? 'Dark Mode' : 'Vibrant'}</span>
                </label>
              ))}
            </div>
            <div className="grid-2" style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label>Slide Density</label>
                <select name="slideDensity" value={formData.slideDensity} onChange={handleChange}>
                  {['Light — max 3 points per slide','Standard — max 5 points per slide','Dense — max 7 points per slide'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Approximate Slide Count</label>
                <select name="slideCount" value={formData.slideCount} onChange={handleChange}>
                  {['Short (10–15 slides)','Medium (15–20 slides)','Long (20–30 slides)','Comprehensive (30+ slides)'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Special Instructions <span className="hint">(optional)</span></label>
                <textarea name="specialInstructions" value={formData.specialInstructions} onChange={handleChange}
                  placeholder="Anything specific to focus on, avoid, or include for this class..." rows={3} />
              </div>
            </div>
          </CollapsibleSection>

          <div className="generate-cta">
            <button className="btn-generate" onClick={handleGenerate}>
              <Play size={20} fill="currentColor" />
              Generate Tafsir Lesson
            </button>
          </div>
        </>
      )}

      {/* ============================================================= */}
      {/* GENERATION PROGRESS — shown during all 3 stages */}
      {/* ============================================================= */}
      {(genStage === 'planning' || genStage === 'generating' || genStage === 'assembling') && (
        <div className="gen-container">
          <div className="gen-stages">
            {Object.entries(STAGES).map(([key, info]) => {
              const stageOrder = ['planning', 'generating', 'assembling'];
              const currentIdx = stageOrder.indexOf(genStage);
              const thisIdx = stageOrder.indexOf(key);
              const isDone = thisIdx < currentIdx;
              const isActive = thisIdx === currentIdx;
              return (
                <div key={key} className={`gen-stage ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <div className="gen-stage-icon">{isDone ? '✅' : isActive ? <Loader2 size={22} className="spin" /> : info.icon}</div>
                  <div>
                    <p className="gen-stage-label">{info.label}</p>
                    {isActive && <p className="gen-stage-desc">{progressMsg}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="gen-note">This may take a minute. Gemini is researching authentic Tafsir sources...</p>
        </div>
      )}

      {/* ============================================================= */}
      {/* ERROR STATE */}
      {/* ============================================================= */}
      {genStage === 'error' && (
        <div className="gen-container">
          <div className="error-box">
            <AlertCircle size={40} color="#ef4444" />
            <h2>Generation Failed</h2>
            <p>{errorMsg}</p>
            <button className="btn-primary" onClick={resetApp}>← Try Again</button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* COMPLETE STATE */}
      {/* ============================================================= */}
      {genStage === 'complete' && (
        <div className="gen-container">
          <div className="result-card">
            <div className="result-icon">
              <CheckCircle size={48} color="var(--accent-primary)" />
            </div>
            <h2 className="result-title">Your Lesson is Ready!</h2>
            <p className="result-sub">
              Generated <strong>{resultSlides.length} slides</strong> for <strong>{formData.surahName}</strong>
              {formData.verseRange ? ` (${formData.verseRange})` : ' (Full Surah)'}
            </p>

            <div className="result-meta">
              <span>👤 {formData.ageGroup}</span>
              <span>🌍 {formData.deliveryLanguage}</span>
              <span>🎨 {formData.theme === 'classic' ? 'Classic Islamic' : formData.theme === 'default' ? 'Modern Minimal' : formData.theme === 'dark' ? 'Dark Mode' : 'Vibrant'}</span>
            </div>

            <div className="result-actions">
              <button className="btn-secondary" onClick={previewHtml}>
                <Eye size={18} /> Preview in Browser
              </button>
              <button className="btn-primary" onClick={downloadHtml}>
                <Download size={18} /> Download HTML File
              </button>
            </div>
            <button className="link-btn" onClick={resetApp}>← Create a New Lesson</button>
          </div>
        </div>
      )}

      {/* Premium UX Styles embedded in App */}
      <style>{`
        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          padding: 1.5rem 2rem;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          box-shadow: var(--shadow-sm);
        }
        .brand { display: flex; align-items: center; gap: 1rem; }
        .brand-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          border-radius: 0.75rem;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .brand-name { font-size: 1.3rem; font-weight: 700; line-height: 1.2; color: var(--text-primary); }
        .brand-sub { font-size: 0.8rem; color: var(--text-secondary); }
        .settings-btn {
          display: flex; align-items: center; gap: 0.5rem;
          background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: 0.5rem; padding: 0.5rem 1rem;
          font-size: 0.9rem; font-weight: 500; color: var(--text-secondary);
          cursor: pointer; transition: all 0.2s;
        }
        .settings-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
        .settings-card { border: 2px solid var(--accent-primary); }
        .icon-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary); border-radius: 0.4rem; padding: 0.25rem; display: flex; }
        .icon-btn:hover { background: var(--border-color); }

        .collapsible-header {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; background: none; border: none; cursor: pointer;
          padding: 0; text-align: left;
        }
        .collapsible-body { margin-top: 1.5rem; }

        .sections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.75rem;
        }
        .section-checkbox {
          display: flex; align-items: center; gap: 0.75rem;
          cursor: pointer; padding: 0.6rem 0.75rem;
          border-radius: 0.5rem; border: 1px solid var(--border-color);
          background: var(--bg-card); font-size: 0.9rem;
          transition: all 0.2s;
        }
        .section-checkbox:hover { border-color: var(--accent-primary); background: var(--accent-secondary); }
        .section-checkbox input[type="checkbox"] { accent-color: var(--accent-primary); width: 1.1rem; height: 1.1rem; flex-shrink: 0; }

        .theme-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }
        @media (max-width: 640px) { .theme-grid { grid-template-columns: 1fr 1fr; } }
        .theme-option {
          display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
          cursor: pointer; padding: 0.75rem;
          border-radius: 0.75rem; border: 2px solid var(--border-color);
          font-size: 0.85rem; font-weight: 500; text-align: center;
          transition: all 0.2s; background: var(--bg-card);
        }
        .theme-option input { display: none; }
        .theme-option.selected { border-color: var(--accent-primary); box-shadow: 0 0 0 3px var(--accent-secondary); }
        .theme-preview {
          width: 100%; height: 48px;
          border-radius: 0.4rem; overflow: hidden;
        }
        .theme-preview.theme-classic { background: linear-gradient(135deg, #1a4731, #d4a017); }
        .theme-preview.theme-default { background: linear-gradient(135deg, #0284c7, #0ea5e9); }
        .theme-preview.theme-dark { background: linear-gradient(135deg, #0f172a, #1e40af); }
        .theme-preview.theme-vibrant { background: linear-gradient(135deg, #7c3aed, #f59e0b); }

        .generate-cta {
          text-align: center; padding: 2rem 0 4rem;
        }
        .btn-generate {
          background: linear-gradient(135deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 70%, black));
          color: #fff; border: none; padding: 1rem 3rem;
          border-radius: 100px; font-size: 1.15rem; font-weight: 700;
          cursor: pointer; box-shadow: 0 8px 25px rgba(0,0,0,0.2);
          display: inline-flex; align-items: center; gap: 0.75rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn-generate:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
        .btn-generate:active { transform: scale(0.98); }

        .gen-container {
          max-width: 640px; margin: 4rem auto; padding: 0 1rem;
        }
        .gen-stages {
          background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: 1.25rem; padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem;
          box-shadow: var(--shadow-lg);
        }
        .gen-stage {
          display: flex; align-items: flex-start; gap: 1rem;
          padding: 1rem; border-radius: 0.75rem;
          transition: background 0.3s;
        }
        .gen-stage.active { background: var(--accent-secondary); }
        .gen-stage.done { opacity: 0.5; }
        .gen-stage-icon { font-size: 1.4rem; flex-shrink: 0; }
        .gen-stage-label { font-weight: 600; color: var(--text-primary); }
        .gen-stage-desc { font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.2rem; }
        .gen-note { text-align: center; color: var(--text-secondary); font-size: 0.85rem; margin-top: 1.5rem; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .error-box {
          text-align: center; background: var(--bg-card); border-radius: 1.25rem;
          padding: 3rem; border: 2px solid #ef4444;
          display: flex; flex-direction: column; align-items: center; gap: 1rem;
          box-shadow: var(--shadow-lg);
        }
        .error-box h2 { font-size: 1.5rem; color: var(--text-primary); }
        .error-box p { color: var(--text-secondary); max-width: 480px; word-break: break-word; }

        .result-card {
          background: var(--bg-card); border-radius: 1.5rem;
          border: 1px solid var(--border-color);
          padding: 3rem; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.1);
          display: flex; flex-direction: column; align-items: center; gap: 1.25rem;
        }
        .result-title { font-size: 1.8rem; font-weight: 700; color: var(--text-primary); }
        .result-sub { font-size: 1.05rem; color: var(--text-secondary); }
        .result-meta {
          display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center;
          margin: 0.5rem 0;
        }
        .result-meta span {
          background: var(--accent-secondary); color: var(--accent-primary);
          padding: 0.35rem 0.85rem; border-radius: 100px; font-size: 0.85rem; font-weight: 500;
        }
        .result-actions { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem; }
        .link-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.9rem; text-decoration: underline; margin-top: 0.5rem; }

        .hint { font-size: 0.8rem; color: var(--text-secondary); font-weight: 400; }
        a { color: var(--accent-primary); }
      `}</style>
    </div>
  );
}

export default App;
