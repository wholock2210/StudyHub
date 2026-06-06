import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { VocabItem, VocabSet, Category } from '../types';
import { CATEGORIES } from '../types';
import { generateId, addVocabSet, formatDate } from '../utils/helpers';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';
import { renderMarkdown } from '../utils/markdown';
import FormatToolbar from '../components/FormatToolbar';
import VocabFormCard from '../components/VocabFormCard';
import { getCategoryLabel } from './CreateSet';

function parseVocabLines(raw: string): VocabItem[] {
  return raw.split('\n').filter(l => l.trim()).map((line, i) => {
    const parts = line.split('|').map(p => p.trim());
    return {
      id: `v-${i}-${parts[0]?.slice(0, 10) || i}`,
      word: parts[0] || '',
      meaning: parts[1] || '',
      example: parts[2] || undefined,
      phonetic: parts[3] || undefined,
    };
  }).filter(v => v.word && v.meaning);
}

export default function VocabEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const lang = settings.language;

  const navState = location.state as { vocabSet?: VocabSet; category?: Category } | null;
  const existing = navState?.vocabSet;
  const initialCategory = existing?.category || navState?.category || 'general';

  const [rawText, setRawText] = useState(() => {
    if (existing) {
      return existing.items.map(v =>
        [v.word, v.meaning, v.example, v.phonetic].filter(Boolean).join(' | ')
      ).join('\n');
    }
    return '';
  });
  const [setName, setSetName] = useState(existing?.name || '');
  const [category, setCategory] = useState<Category>(initialCategory);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'text' | 'ui'>(existing ? 'ui' : 'text');

  const items: VocabItem[] = useMemo(() => parseVocabLines(rawText), [rawText]);

  // UI mode: direct items state
  const [uiItems, setUiItems] = useState<VocabItem[]>(() => existing ? existing.items : []);

  // Sync items when switching modes
  const switchMode = useCallback((newMode: 'text' | 'ui') => {
    if (newMode === mode) return;
    if (newMode === 'ui') {
      // text -> ui: parse rawText into uiItems
      setUiItems(items);
    } else {
      // ui -> text: serialize uiItems into rawText
      setRawText(uiItems.map(v =>
        [v.word, v.meaning, v.example, v.phonetic].filter(Boolean).join(' | ')
      ).join('\n'));
    }
    setMode(newMode);
  }, [mode, items, uiItems]);

  // UI mode handlers
  const handleUiItemChange = useCallback((index: number, item: VocabItem) => {
    setUiItems(prev => {
      const next = [...prev];
      next[index] = item;
      return next;
    });
  }, []);

  const handleUiItemDelete = useCallback((index: number) => {
    setUiItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUiAddItem = useCallback(() => {
    const newItem: VocabItem = {
      id: generateId(),
      word: '',
      meaning: '',
    };
    setUiItems(prev => [...prev, newItem]);
  }, []);

  const handleUiMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setUiItems(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleUiMoveDown = useCallback((index: number) => {
    setUiItems(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  // Use the correct items source based on mode
  const activeItems = mode === 'ui' ? uiItems : items;

  const handleSave = useCallback(() => {
    const vocabSet: VocabSet = {
      id: existing?.id || generateId(),
      name: setName || 'Bộ thẻ học',
      category,
      createdAt: existing?.createdAt || formatDate(new Date()),
      items: activeItems,
    };
    addVocabSet(vocabSet);
    setSaved(true);
    setTimeout(() => {
      navigate('/sets');
    }, 800);
  }, [setName, category, activeItems, existing, navigate]);

  const SAMPLE_VOCAB = 'hello | xin chào | **Hello**, how are you? | /həˈloʊ/\nstudy | học | I ==study== English every day. | /ˈstʌdi/\nbeautiful | đẹp | What a {blue}beautiful{/blue} day! | /ˈbjuːtɪfəl/\nmeeting | cuộc họp | The _meeting_ starts at __9 AM__. | /ˈmiːtɪŋ/';

  const handleCopySample = useCallback(() => {
    navigator.clipboard.writeText(SAMPLE_VOCAB).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleUseSample = useCallback(() => {
    setRawText(SAMPLE_VOCAB);
  }, []);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {existing ? t('vocab.editTitle', lang) : t('vocab.createTitle', lang)}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {mode === 'text' ? t('vocab.format', lang) : 'Thêm và chỉnh sửa thẻ học bằng giao diện trực quan.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => switchMode('text')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'text'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('editor.textMode', lang)}
            </button>
            <button
              type="button"
              onClick={() => switchMode('ui')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'ui'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('editor.uiMode', lang)}
            </button>
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as Category)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.icon} {getCategoryLabel(cat.key, lang)}</option>
            ))}
          </select>
          <input
            type="text"
            value={setName}
            onChange={e => setSetName(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none flex-1 sm:w-56 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder={t('vocab.name', lang)}
          />
          <button
            onClick={handleSave}
            disabled={activeItems.length === 0}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-md ${
              saved
                ? 'bg-green-500 text-white shadow-green-500/25'
                : 'bg-linear-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700 shadow-cyan-500/25'
            }`}
          >
            {saved ? t('vocab.saved', lang) : t('vocab.save', lang)}
          </button>
        </div>
      </div>

      {/* Instructions (text mode only) */}
      {mode === 'text' && (
        <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-cyan-900 dark:text-cyan-200 mb-2">{t('instr.title', lang)}</h3>
              <div className="text-xs text-cyan-800 dark:text-cyan-300 space-y-1 mb-3">
                <p><strong>{t('instr.required', lang)}</strong> {t('vocab.format', lang)}</p>
                <p><code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">từ</code> <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">|</code> <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">nghĩa</code> <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">|</code> <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">ví dụ</code> <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">|</code> <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">phiên âm</code></p>
                <p><strong>{t('instr.format', lang)}</strong>{' '}
                  <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">**đậm**</code>{' '}
                  <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">*nghiêng*</code>{' '}
                  <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">__gạch chân__</code>{' '}
                  <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">~~gạch ngang~~</code>{' '}
                  <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">==tô sáng==</code>
                </p>
                <p><strong>{t('instr.colors', lang)}</strong> <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">{'{red}text{/red}'}</code> — red, blue, green, yellow, orange, purple, pink, gray, cyan, indigo, teal, lime hoặc <code className="bg-cyan-100 dark:bg-cyan-800/50 px-1 rounded">{'{#ff0000}text{/#ff0000}'}</code></p>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={handleCopySample}
                className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                {copied ? '✓ Đã copy' : t('instr.copySample', lang)}
              </button>
              <button
                onClick={handleUseSample}
                className="px-3 py-1.5 border border-cyan-400 dark:border-cyan-600 text-cyan-800 dark:text-cyan-300 text-xs font-medium rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                {t('instr.trySample', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text mode: Split view */}
      {mode === 'text' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
          {/* Left: textarea */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('vocab.input', lang)}
              </label>
              <div className="flex items-center gap-2">
                <FormatToolbar targetId="vocab-textarea" value={rawText} onChange={setRawText} compact />
                {rawText && (
                  <button onClick={() => setRawText('')} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    Xoá
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="vocab-textarea"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              className="flex-1 min-h-48 lg:min-h-0 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder={"hello | xin chào | Hello, how are you? | /həˈloʊ/\nstudy | học | I study English every day. | /ˈstʌdi/\nbeautiful | đẹp | What a beautiful day! | /ˈbjuːtɪfəl/"}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {rawText.split('\n').filter(l => l.trim()).length} dòng
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {items.length > 0 && `${items.length} ${t('vocab.items', lang)}`}
              </span>
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('vocab.preview', lang)}
              {items.length > 0 && (
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">({items.length} {t('vocab.items', lang)})</span>
              )}
            </label>
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
              {items.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                  {t('vocab.noItems', lang)}
                </div>
              ) : (
                items.map((v, i) => (
                  <div key={v.id} className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 animate-fadeIn stagger-${Math.min(i + 1, 5)}`}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{v.word}</span>
                      {v.phonetic && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{v.phonetic}</span>}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{v.meaning}</p>
                    {v.example && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.example) }} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* UI mode: form cards */}
      {mode === 'ui' && (
        <div className="space-y-4">
          {uiItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <p className="text-sm">{t('editor.noCards', lang)}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uiItems.map((v, i) => (
                <VocabFormCard
                  key={v.id}
                  item={v}
                  index={i}
                  onChange={updated => handleUiItemChange(i, updated)}
                  onDelete={() => handleUiItemDelete(i)}
                  onMoveUp={() => handleUiMoveUp(i)}
                  onMoveDown={() => handleUiMoveDown(i)}
                  isFirst={i === 0}
                  isLast={i === uiItems.length - 1}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleUiAddItem}
            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-cyan-400 dark:hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-all"
          >
            {t('editor.addCard', lang)}
          </button>
          {uiItems.length > 0 && (
            <div className="text-center text-xs text-gray-400 dark:text-gray-500">
              {uiItems.length} {t('vocab.items', lang)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
