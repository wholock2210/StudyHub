import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Question, VocabItem, QuestionSet, VocabSet, Category } from '../types';
import { CATEGORIES } from '../types';
import { generateId, addSet, addVocabSet, formatDate, loadAISettings, loadVocabSets } from '../utils/helpers';
import { generateQuizWithAI, generateFlashcardWithAI, analyzeDescription, type AnalysisOption, type AnalysisResponse } from '../utils/aiGenerator';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';
import { renderMarkdown } from '../utils/markdown';
import QuestionPreview from '../components/QuestionPreview';
import QuestionEditPanel from '../components/QuestionEditPanel';
import { getCategoryLabel } from './CreateSet';

type Tab = 'quiz' | 'flash';
type Phase = 'input' | 'analyzing' | 'conversation' | 'generating' | 'result';

interface HistoryEntry {
  question: string;
  selectedOption: string;
}

export default function GeneratePage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const lang = settings.language;

  const [phase, setPhase] = useState<Phase>('input');
  const [tab, setTab] = useState<Tab>('quiz');
  const [description, setDescription] = useState('');
  const [count, setCount] = useState(40);
  const [customCount, setCustomCount] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Conversation state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentAI, setCurrentAI] = useState<AnalysisResponse | null>(null);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [loadingNext, setLoadingNext] = useState(false);

  // Flashcard state
  const [flashcardSets, setFlashcardSets] = useState<VocabSet[]>([]);
  const [useFlashcard, setUseFlashcard] = useState(false);
  const [selectedFlashcardSets, setSelectedFlashcardSets] = useState<string[]>([]);
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const [excludedWords, setExcludedWords] = useState<Record<string, string[]>>({});

  // Results
  const [quizResult, setQuizResult] = useState<Question[]>([]);
  const [flashResult, setFlashResult] = useState<VocabItem[]>([]);
  const [setName, setSetName] = useState('');
  const [category, setCategory] = useState<Category>('general');

  // Edit state for quiz questions
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const aiSettings = loadAISettings();
  const hasApiKey = !!aiSettings.apiKey;

  useEffect(() => {
    setFlashcardSets(loadVocabSets());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, currentAI, phase]);

  const effectiveCount = customCount ? parseInt(customCount) || count : count;
  const countOptions = tab === 'quiz' ? [20, 30, 40, 50] : [20, 40, 60, 80];

  // Phase 1: Initial analysis
  const handleStart = useCallback(async () => {
    if (!description.trim()) {
      setError(t('gen.noTopic', lang));
      return;
    }
    if (!hasApiKey) {
      navigate('/settings');
      return;
    }
    setError('');
    setPhase('analyzing');
    setHistory([]);
    setMultiSelected([]);

    try {
      const result = await analyzeDescription(description, [], '', aiSettings);
      setCurrentAI(result);
      setPhase('conversation');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('gen.analyzeError', lang));
      setPhase('input');
    }
  }, [description, hasApiKey, aiSettings, lang, navigate]);

  // Single-select: click to confirm and move next
  const handleSingleSelect = useCallback(async (option: AnalysisOption) => {
    if (!currentAI) return;
    const entry: HistoryEntry = { question: currentAI.question, selectedOption: option.label };
    await advanceConversation(entry);
  }, [currentAI, history, description, aiSettings]);

  // Multi-select: toggle checkbox
  const toggleMultiSelect = useCallback((id: string) => {
    setMultiSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  // Multi-select: confirm selection
  const handleMultiConfirm = useCallback(async () => {
    if (!currentAI || multiSelected.length === 0) return;
    const labels = currentAI.options
      .filter(opt => multiSelected.includes(opt.id))
      .map(opt => opt.label);
    const entry: HistoryEntry = {
      question: currentAI.question,
      selectedOption: labels.join(', '),
    };
    setMultiSelected([]);
    await advanceConversation(entry);
  }, [currentAI, multiSelected, history, description, aiSettings]);

  // Shared: advance to next question or generate
  const advanceConversation = useCallback(async (entry: HistoryEntry) => {
    const newHistory = [...history, entry];
    setHistory(newHistory);
    setCurrentAI(null);
    setLoadingNext(true);

    try {
      const result = await analyzeDescription(description, newHistory, '', aiSettings);

      if (result.done) {
        const finalHistory = [
          ...newHistory,
          ...result.options.map(opt => ({
            question: result.question,
            selectedOption: opt.label,
          })),
        ];
        setHistory(finalHistory);
        setCurrentAI(null);
        setPhase('generating');
        await doGenerate(finalHistory);
      } else {
        setCurrentAI(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('gen.analyzeError', lang));
    } finally {
      setLoadingNext(false);
    }
  }, [history, description, aiSettings]);

  // Send custom input
  const handleSendCustom = useCallback(async () => {
    if (!customInput.trim() || !currentAI) return;
    const entry: HistoryEntry = {
      question: currentAI.question,
      selectedOption: customInput.trim(),
    };
    setCustomInput('');
    setMultiSelected([]);
    await advanceConversation(entry);
  }, [customInput, currentAI, advanceConversation]);

  // Go back
  const handleBack = useCallback(() => {
    if (history.length === 0) {
      setPhase('input');
      setCurrentAI(null);
      setMultiSelected([]);
      return;
    }
    const newHistory = [...history];
    const removed = newHistory.pop()!;
    setHistory(newHistory);
    setMultiSelected([]);
    setCurrentAI({
      question: removed.question,
      type: 'single',
      done: false,
      options: currentAI
        ? [...currentAI.options, { id: 'prev', label: removed.selectedOption, description: '' }]
        : [{ id: 'prev', label: removed.selectedOption, description: '' }],
    });
  }, [history, currentAI]);

  // Generate content
  const doGenerate = useCallback(async (finalHistory: HistoryEntry[]) => {
    setPhase('generating');
    setSaved(false);
    setQuizResult([]);
    setFlashResult([]);

    const keywords = finalHistory.map(h => h.selectedOption).join(', ');

    // Build flashcard context
    let flashcardContext = '';
    if (useFlashcard && selectedFlashcardSets.length > 0) {
      const allWords: string[] = [];
      for (const setId of selectedFlashcardSets) {
        const vs = flashcardSets.find(s => s.id === setId);
        if (!vs) continue;
        const excluded = excludedWords[setId] || [];
        allWords.push(...vs.items.filter(item => !excluded.includes(item.word)).map(item => item.word));
      }
      if (allWords.length > 0) flashcardContext = allWords.join(', ');
    }

    try {
      if (tab === 'quiz') {
        const questions = await generateQuizWithAI({
          topic: keywords,
          count: effectiveCount,
          type: 'quiz',
          description,
          selectedOptions: finalHistory.map(h => h.selectedOption),
          flashcardContext: flashcardContext || undefined,
        }, aiSettings);
        setQuizResult(questions);
      } else {
        const items = await generateFlashcardWithAI({
          topic: keywords,
          count: effectiveCount,
          type: 'flashcard',
          description,
          selectedOptions: finalHistory.map(h => h.selectedOption),
        }, aiSettings);
        setFlashResult(items);
      }
      setPhase('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('gen.error', lang));
      setPhase('conversation');
    }
  }, [tab, effectiveCount, description, useFlashcard, selectedFlashcardSets, flashcardSets, excludedWords, aiSettings, lang]);

  const handleGenerate = useCallback(async () => {
    await doGenerate(history);
  }, [doGenerate, history]);

  const handleSave = useCallback(() => {
    if (tab === 'quiz' && quizResult.length > 0) {
      const qs: QuestionSet = {
        id: generateId(),
        name: setName || `${description.slice(0, 50)} - AI`,
        category,
        createdAt: formatDate(new Date()),
        questions: quizResult,
        examTimeLimit: 30,
        shuffleAnswers: false,
      };
      addSet(qs);
      setSaved(true);
      setTimeout(() => navigate('/sets'), 800);
    } else if (tab === 'flash' && flashResult.length > 0) {
      const vs: VocabSet = {
        id: generateId(),
        name: setName || `${description.slice(0, 50)} - Vocabulary`,
        category,
        createdAt: formatDate(new Date()),
        items: flashResult,
      };
      addVocabSet(vs);
      setSaved(true);
      setTimeout(() => navigate('/sets'), 800);
    }
  }, [tab, quizResult, flashResult, setName, category, description, navigate]);

  const hasResult = tab === 'quiz' ? quizResult.length > 0 : flashResult.length > 0;
  const isMulti = currentAI?.type === 'multi';
  const canConfirmMulti = isMulti && multiSelected.length > 0;

  // Edit handlers
  const handleEditQuestion = useCallback((index: number) => {
    setEditIndex(index);
  }, []);

  const handleEditSave = useCallback((updated: Question) => {
    if (editIndex === null) return;
    setQuizResult(prev => {
      const next = [...prev];
      next[editIndex] = updated;
      return next;
    });
    setEditIndex(null);
  }, [editIndex]);

  const handleEditCancel = useCallback(() => {
    setEditIndex(null);
  }, []);

  // Flashcard helpers
  const toggleFlashcardSet = (id: string) => {
    setSelectedFlashcardSets(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    if (!selectedFlashcardSets.includes(id)) setExpandedSet(id);
  };
  const toggleExcludeWord = (setId: string, word: string) => {
    setExcludedWords(prev => {
      const current = prev[setId] || [];
      return { ...prev, [setId]: current.includes(word) ? current.filter(w => w !== word) : [...current, word] };
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('gen.title', lang)}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('gen.subtitle', lang)}</p>
      </div>

      {/* Type tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 w-fit">
        <button type="button" onClick={() => { setTab('quiz'); setQuizResult([]); setFlashResult([]); setSaved(false); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'quiz' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          {t('gen.quizTab', lang)}
        </button>
        <button type="button" onClick={() => { setTab('flash'); setQuizResult([]); setFlashResult([]); setSaved(false); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'flash' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          {t('gen.flashTab', lang)}
        </button>
      </div>

      {/* === PHASE: INPUT === */}
      {phase === 'input' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{t('gen.describeLabel', lang)}</label>
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} spellCheck={false} autoComplete="off"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                placeholder={t('gen.describePlaceholder', lang)} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 py-0.5">{t('gen.suggestions', lang)}</span>
                {(['gen.sug1', 'gen.sug2', 'gen.sug3', 'gen.sug4'] as const).map(key => (
                  <button key={key} type="button" onClick={() => setDescription(t(key, lang))}
                    className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                    {t(key, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{t('gen.countLabel', lang)}</label>
              <div className="flex gap-2 items-center flex-wrap">
                {countOptions.map(n => (
                  <button key={n} type="button" onClick={() => { setCount(n); setCustomCount(''); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all hover:scale-105 active:scale-95 ${
                      count === n && !customCount ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}>{n}</button>
                ))}
                <input type="number" min={1} max={200} value={customCount} onChange={e => setCustomCount(e.target.value)} spellCheck={false} autoComplete="off" placeholder="..."
                  className="w-20 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
            </div>

            <button type="button" onClick={handleStart} disabled={!description.trim() || !hasApiKey}
              className={`w-full px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md ${
                !hasApiKey ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-linear-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}>
              {t('gen.analyzeBtn', lang)}
            </button>
            {!hasApiKey && (
              <button type="button" onClick={() => navigate('/settings')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{t('gen.goSettings', lang)} →</button>
            )}
          </div>
        </div>
      )}

      {/* === PHASE: ANALYZING === */}
      {phase === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <svg className="w-10 h-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('gen.analyzing', lang)}</p>
        </div>
      )}

      {/* === PHASE: CONVERSATION === */}
      {phase === 'conversation' && (
        <div className="space-y-4">
          {/* History panel */}
          {history.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('gen.analysisResult', lang)}</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">{history.length} {t('gen.selectedCount', lang).replace('{n}', '')}</span>
              </div>
              <div className="space-y-1.5">
                {history.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm animate-fadeIn">
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 shrink-0">Q{i + 1}:</span>
                    <div className="min-w-0">
                      <p className="text-gray-500 dark:text-gray-400 text-xs">{entry.question}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">→ {entry.selectedOption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flashcard toggle */}
          {flashcardSets.length > 0 && (
            <button type="button" onClick={() => setUseFlashcard(!useFlashcard)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all hover:scale-[1.01] ${
                useFlashcard ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${useFlashcard ? 'border-cyan-500 bg-cyan-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {useFlashcard && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                  <p className="text-sm font-medium">{t('gen.flashcardToggle', lang)}</p>
                  <p className="text-xs opacity-70 mt-0.5">{t('gen.flashcardDesc', lang)}</p>
                </div>
              </div>
            </button>
          )}

          {/* Flashcard set selector */}
          {useFlashcard && flashcardSets.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 animate-fadeIn">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('gen.selectFlashcardsHint', lang)}</p>
              {flashcardSets.map(vs => {
                const isSetSelected = selectedFlashcardSets.includes(vs.id);
                const isExpanded = expandedSet === vs.id;
                const excluded = excludedWords[vs.id] || [];
                const selectedWordCount = vs.items.length - excluded.length;
                return (
                  <div key={vs.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button type="button" onClick={() => toggleFlashcardSet(vs.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSetSelected ? 'border-cyan-500 bg-cyan-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {isSetSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{vs.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {isSetSelected ? `${selectedWordCount}/${vs.items.length} ${t('vocab.items', lang)}` : `${vs.items.length} ${t('vocab.items', lang)}`}
                        </p>
                      </div>
                      {isSetSelected && (
                        <button type="button" onClick={() => setExpandedSet(isExpanded ? null : vs.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {isSetSelected && isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 max-h-48 overflow-y-auto">
                        <div className="flex flex-wrap gap-1.5">
                          {vs.items.map(item => {
                            const isExcluded = excluded.includes(item.word);
                            return (
                              <button key={item.id} type="button" onClick={() => toggleExcludeWord(vs.id, item.word)}
                                className={`px-2 py-1 text-xs rounded-full border transition-all ${
                                  isExcluded ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 line-through'
                                    : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600'
                                }`}>
                                {item.word}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Current AI question */}
          {currentAI && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{currentAI.question}</p>
                {isMulti && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">{t('gen.multiSelect', lang)}</span>}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {currentAI.options.map(opt => {
                  const isSelected = isMulti && multiSelected.includes(opt.id);
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => isMulti ? toggleMultiSelect(opt.id) : handleSingleSelect(opt)}
                      disabled={loadingNext}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all hover:scale-[1.01] disabled:opacity-50 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      }`}>
                      <div className="flex items-center gap-3">
                        {isMulti && (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        )}
                        <div>
                          <p className={`text-sm font-medium ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200'}`}>{opt.label}</p>
                          {opt.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Confirm button for multi-select */}
              {isMulti && (
                <button type="button" onClick={handleMultiConfirm} disabled={!canConfirmMulti || loadingNext}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    canConfirmMulti
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }`}>
                  {t('gen.confirmBtn', lang)} ({multiSelected.length})
                </button>
              )}

              {/* Custom input */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex gap-2">
                  <input type="text" value={customInput} onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendCustom(); }}
                    spellCheck={false} autoComplete="off"
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder={t('gen.extraInfoPlaceholder', lang)} />
                  <button type="button" onClick={handleSendCustom} disabled={!customInput.trim() || loadingNext}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50">
                    {t('gen.sendBtn', lang)}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleBack} disabled={loadingNext}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hover:scale-105 active:scale-95">
                  {t('gen.backBtn', lang)}
                </button>
                <button type="button" onClick={handleGenerate} disabled={history.length === 0}
                  className="flex-1 px-6 py-2.5 rounded-lg text-sm font-medium bg-linear-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                  {t('gen.createBtn', lang)} ({effectiveCount})
                </button>
              </div>
            </div>
          )}

          {/* Loading next */}
          {loadingNext && (
            <div className="flex items-center justify-center py-6 gap-2">
              <svg className="w-5 h-5 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('gen.analyzing', lang)}</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* === PHASE: GENERATING === */}
      {phase === 'generating' && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <svg className="w-10 h-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('gen.generating', lang)}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 animate-scaleIn">{error}</p>
      )}

      {/* === PHASE: RESULT === */}
      {phase === 'result' && hasResult && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{t('gen.setName', lang)}</label>
              <input type="text" value={setName} onChange={e => setSetName(e.target.value)} spellCheck={false} autoComplete="off"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder={`${description.slice(0, 50)} - AI`} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                {lang === 'vi' ? 'Môn học' : 'Subject'}
              </label>
              <select value={category} onChange={e => setCategory(e.target.value as Category)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                {CATEGORIES.map(cat => (
                  <option key={cat.key} value={cat.key}>{cat.icon} {getCategoryLabel(cat.key, lang)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Edit panel */}
          {editIndex !== null && editIndex < quizResult.length && (
            <QuestionEditPanel
              question={quizResult[editIndex]}
              index={editIndex}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {t('gen.preview', lang)}
                <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                  ({tab === 'quiz' ? `${quizResult.length} câu hỏi` : `${flashResult.length} thẻ`})
                </span>
              </h2>
              <button type="button" onClick={() => { setPhase('conversation'); setQuizResult([]); setFlashResult([]); }}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">{t('gen.backBtn', lang)}</button>
            </div>

            {tab === 'quiz' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quizResult.map((q, i) => <QuestionPreview key={q.id} question={q} index={i} onEdit={() => handleEditQuestion(i)} />)}
              </div>
            )}
            {tab === 'flash' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {flashResult.map((v, i) => (
                  <div key={v.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{v.word}</span>
                      {v.phonetic && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{v.phonetic}</span>}
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">#{i + 1}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.meaning) }} />
                    {v.vietnamese && <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">{v.vietnamese}</p>}
                    {v.example && <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.example) }} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={handleSave} disabled={saved}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95 shadow-md ${
                saved ? 'bg-green-500 text-white shadow-green-500/25' : 'bg-linear-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700 shadow-cyan-500/25'
              }`}>
              {saved ? t('gen.saved', lang) : t('gen.save', lang)}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {phase === 'input' && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <p className="text-sm">{t('gen.noResult', lang)}</p>
        </div>
      )}
    </div>
  );
}
