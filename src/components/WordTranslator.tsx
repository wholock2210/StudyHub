import { useState, useEffect, useRef, useCallback } from 'react';
import type { VocabSet, VocabItem } from '../types';
import { loadVocabSets, addVocabSet, generateId } from '../utils/helpers';
import { loadAISettings } from '../utils/helpers';
import { translateWordWithAI, type WordTranslation } from '../utils/aiGenerator';
import { renderMarkdown } from '../utils/markdown';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';

interface WordTranslatorProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
}

type TranslationState =
  | { status: 'loading' }
  | { status: 'result'; data: WordTranslation }
  | { status: 'no-result' }
  | { status: 'adding'; data: WordTranslation }
  | { status: 'added' };

export default function WordTranslator({ word, position, onClose }: WordTranslatorProps) {
  const { settings } = useSettings();
  const lang = settings.language;
  const [state, setState] = useState<TranslationState>({ status: 'loading' });
  const [vocabSets, setVocabSets] = useState<VocabSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [createNew, setCreateNew] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay within viewport; flip above if not enough space below
  const adjustedPos = useRef({ x: position.x, y: position.y });
  const originY = useRef(position.y);

  useEffect(() => {
    originY.current = position.y;

    const adjust = () => {
      const el = popoverRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // visualViewport excludes mobile system UI (home bar, nav toolbar)
      const vv = window.visualViewport;
      const vw = vv ? vv.width : window.innerWidth;
      const vh = vv ? vv.height : window.innerHeight;
      const offsetX = vv ? vv.offsetLeft : 0;
      const offsetY = vv ? vv.offsetTop : 0;

      let x = position.x;
      let y = position.y;
      const vx = x - window.scrollX;
      const vy = y - window.scrollY;

      // Horizontal clamp
      if (vx + rect.width > vw - 16) x = window.scrollX + offsetX + vw - rect.width - 16;
      if (vx < 16) x = window.scrollX + offsetX + 16;

      // Bottom overflow → flip above the word
      if (vy + rect.height > vh - 16) {
        y = originY.current - rect.height - 8;
      }
      // Top overflow after flip → clamp to top
      if (y - window.scrollY < 16) {
        y = window.scrollY + offsetY + 16;
      }

      adjustedPos.current = { x, y };
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    adjust();
  }, [position]);

  // Load vocab sets
  useEffect(() => {
    setVocabSets(loadVocabSets());
  }, []);

  // Translate the word
  useEffect(() => {
    let cancelled = false;

    async function doTranslate() {
      setState({ status: 'loading' });

      // 1. Try dictionary API + Vietnamese translation in parallel
      try {
        const [dictRes, viRes] = await Promise.allSettled([
          fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
          fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`),
        ]);

        let vietnamese = '';
        if (viRes.status === 'fulfilled' && viRes.value.ok) {
          try {
            const viData = await viRes.value.json();
            const match = viData.responseData?.translatedText;
            if (match && match.toLowerCase() !== word.toLowerCase()) {
              vietnamese = match;
            }
          } catch { /* ignore */ }
        }

        if (dictRes.status === 'fulfilled' && dictRes.value.ok) {
          const data = await dictRes.value.json();
          if (!cancelled && data?.length > 0) {
            const entry = data[0];
            const meaning = entry.meanings?.[0];
            const definition = meaning?.definitions?.[0];
            setState({
              status: 'result',
              data: {
                word: entry.word || word,
                meaning: definition?.definition || '',
                vietnamese,
                wordType: meaning?.partOfSpeech || '',
                example: definition?.example || '',
                phonetic: entry.phonetic || entry.phonetics?.find((p: { text?: string }) => p.text)?.text || '',
              },
            });
            return;
          }
        }
      } catch { /* API failed, try AI */ }

      // 2. Try AI fallback
      const aiSettings = loadAISettings();
      if (aiSettings.enabled && aiSettings.apiKey) {
        try {
          const result = await translateWordWithAI(word, aiSettings);
          if (!cancelled && result) {
            setState({ status: 'result', data: result });
            return;
          }
        } catch { /* AI failed */ }
      }

      // 3. No result
      if (!cancelled) {
        setState({ status: 'no-result' });
      }
    }

    doTranslate();
    return () => { cancelled = true; };
  }, [word]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleAddToFlashcard = useCallback(() => {
    if (state.status !== 'result') return;
    setState({ status: 'adding', data: state.data });
  }, [state]);

  const handleSave = useCallback(() => {
    if (state.status !== 'adding') return;
    const { data } = state;

    const newItem: VocabItem = {
      id: generateId(),
      word: data.word,
      meaning: data.meaning,
      vietnamese: data.vietnamese || undefined,
      wordType: data.wordType || undefined,
      example: data.example || undefined,
      phonetic: data.phonetic || undefined,
    };

    if (createNew) {
      // Create new set
      const newSet: VocabSet = {
        id: generateId(),
        name: newSetName || `${data.word} flashcards`,
        category: 'english',
        createdAt: new Date().toISOString().split('T')[0],
        items: [newItem],
      };
      addVocabSet(newSet);
    } else {
      // Add to existing set
      const targetSet = vocabSets.find(vs => vs.id === selectedSetId);
      if (!targetSet) return;
      const updatedSet = {
        ...targetSet,
        items: [...targetSet.items, newItem],
      };
      addVocabSet(updatedSet);
    }

    setState({ status: 'added' });
    setTimeout(onClose, 1200);
  }, [state, createNew, newSetName, selectedSetId, vocabSets, onClose]);

  const WORD_TYPE_LABELS: Record<string, string> = {
    noun: 'Danh từ',
    verb: 'Động từ',
    adjective: 'Tính từ',
    adverb: 'Trạng từ',
    preposition: 'Giới từ',
    conjunction: 'Liên từ',
    pronoun: 'Đại từ',
    phrase: 'Cụm từ',
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 animate-scaleIn"
      style={{ left: adjustedPos.current.x, top: adjustedPos.current.y }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('translate.title', lang)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {state.status === 'loading' && (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">{t('translate.translating', lang)} "{word}"...</span>
            </div>
          )}

          {state.status === 'no-result' && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('translate.notFound', lang)} "{word}"</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('translate.tryAnother', lang)}</p>
            </div>
          )}

          {state.status === 'result' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{state.data.word}</span>
                  {state.data.phonetic && (
                    <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{state.data.phonetic}</span>
                  )}
                </div>
                {state.data.wordType && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 mt-1">
                    {WORD_TYPE_LABELS[state.data.wordType] || state.data.wordType}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('translate.meaning', lang)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: renderMarkdown(state.data.meaning) }} />
              </div>
              {state.data.vietnamese && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Tiếng Việt</p>
                  <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">{state.data.vietnamese}</p>
                </div>
              )}
              {state.data.example && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('translate.example', lang)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic" dangerouslySetInnerHTML={{ __html: `"${renderMarkdown(state.data.example)}"` }} />
                </div>
              )}
              <button
                onClick={handleAddToFlashcard}
                className="w-full mt-2 bg-linear-to-r from-cyan-500 to-cyan-600 text-white py-2 rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-cyan-500/25"
              >
                + {t('translate.addToFlashcard', lang)}
              </button>
            </div>
          )}

          {state.status === 'adding' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('translate.selectSet', lang)} "{state.data.word}"</p>

              {/* Select existing set or create new */}
              <div className="space-y-2">
                {vocabSets.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!createNew}
                      onChange={() => setCreateNew(false)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('translate.existingSet', lang)}</span>
                  </label>
                )}
                {!createNew && vocabSets.length > 0 && (
                  <select
                    value={selectedSetId}
                    onChange={e => setSelectedSetId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">{t('translate.selectSetHint', lang)}</option>
                    {vocabSets.map(vs => (
                      <option key={vs.id} value={vs.id}>{vs.name} ({vs.items.length} thẻ)</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={createNew}
                    onChange={() => setCreateNew(true)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('translate.createNew', lang)}</span>
                </label>
                {createNew && (
                  <input
                    type="text"
                    value={newSetName}
                    onChange={e => setNewSetName(e.target.value)}
                    placeholder="Tên bộ thẻ học..."
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    autoFocus
                  />
                )}
              </div>

              {/* Preview */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs space-y-1">
                <p><strong>Từ:</strong> {state.data.word} {state.data.phonetic && <span className="text-gray-400">{state.data.phonetic}</span>}</p>
                {state.data.wordType && <p><strong>Loại từ:</strong> {WORD_TYPE_LABELS[state.data.wordType] || state.data.wordType}</p>}
                <p><strong>Nghĩa:</strong> {state.data.meaning}</p>
                {state.data.vietnamese && <p><strong>Tiếng Việt:</strong> <span className="text-cyan-600 dark:text-cyan-400">{state.data.vietnamese}</span></p>}
                {state.data.example && <p><strong>Ví dụ:</strong> <em>{state.data.example}</em></p>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setState({ status: 'result', data: state.data })}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                >
                  {t('translate.back', lang)}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!createNew ? !selectedSetId : false}
                  className="flex-1 bg-linear-to-r from-cyan-500 to-cyan-600 text-white py-2 rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-500/25"
                >
                  {t('translate.save', lang)}
                </button>
              </div>
            </div>
          )}

          {state.status === 'added' && (
            <div className="text-center py-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">{t('translate.added', lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
