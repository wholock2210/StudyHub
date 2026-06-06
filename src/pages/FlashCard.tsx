import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VocabSet, VocabItem, StudyMode, SRSRating } from '../types';
import { CATEGORIES } from '../types';
import { loadVocabSets, deleteVocabSet, getDueCards, getSRSStats, updateSRSCard } from '../utils/helpers';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';
import { renderMarkdown } from '../utils/markdown';
import { getCategoryLabel } from './CreateSet';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function highlightBlank(sentence: string, word: string): string {
  const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return renderMarkdown(sentence.replace(regex, '______'));
}

function speakWord(word: string) {
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    // Small delay needed for mobile browsers (iOS Safari, Android Chrome)
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch { /* silent fail on unsupported browsers */ }
    }, 50);
  } catch { /* silent fail on unsupported browsers */ }
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/__(.*?)__/g, '$1').replace(/_(.*?)_/g, '$1').replace(/`{1,3}[^`]*`{1,3}/g, '').replace(/~~(.*?)~~/g, '$1').trim();
}

function SpeakButton({ word, className = '' }: { word: string; className?: string }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); speakWord(word); }}
      className={`inline-flex items-center justify-center p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all hover:scale-110 active:scale-95 ${className}`}
      title="Phát âm"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    </button>
  );
}

function hasExampleWithWord(item: VocabItem): boolean {
  if (!item.example) return false;
  const regex = new RegExp(`\\b${item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(item.example);
}

type RatingLabel = { key: SRSRating; label: string; desc: string; color: string };

export default function FlashCard() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const lang = settings.language;

  const [selectedSet, setSelectedSet] = useState<VocabSet | null>(null);
  const [mode, setMode] = useState<StudyMode | null>(null);
  const [cards, setCards] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [contextInput, setContextInput] = useState('');
  const [contextResult, setContextResult] = useState<'correct' | 'incorrect' | null>(null);
  const [showContextAnswer, setShowContextAnswer] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionStats, setSessionStats] = useState({ studied: 0, correct: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const [sets, setSets] = useState<VocabSet[]>(() => loadVocabSets());

  const handleSelectSet = useCallback((vs: VocabSet) => {
    setSelectedSet(vs);
    setMode(null);
  }, []);

  const startSession = useCallback((selectedMode: StudyMode) => {
    if (!selectedSet) return;
    setMode(selectedMode);

    let sessionCards: VocabItem[];
    if (selectedMode === 'srs') {
      sessionCards = getDueCards(selectedSet.items);
    } else if (selectedMode === 'contextual') {
      sessionCards = selectedSet.items.filter(hasExampleWithWord);
      if (sessionCards.length === 0) sessionCards = selectedSet.items;
    } else {
      sessionCards = [...selectedSet.items];
    }

    setCards(sessionCards.length > 0 ? sessionCards : selectedSet.items);
    setCurrentIndex(0);
    setIsFlipped(false);
    setContextInput('');
    setContextResult(null);
    setShowContextAnswer(false);
    setSessionDone(false);
    setSessionStats({ studied: 0, correct: 0 });
  }, [selectedSet]);

  const handleShuffle = useCallback(() => {
    setCards(prev => shuffleArray(prev));
    setCurrentIndex(0);
    setIsFlipped(false);
    setContextInput('');
    setContextResult(null);
    setShowContextAnswer(false);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setContextInput('');
    setContextResult(null);
    setShowContextAnswer(false);
    setSessionDone(false);
    setSessionStats({ studied: 0, correct: 0 });
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setContextInput('');
      setContextResult(null);
      setShowContextAnswer(false);
    }
  }, [currentIndex, cards.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
      setContextInput('');
      setContextResult(null);
      setShowContextAnswer(false);
    }
  }, [currentIndex]);

  const handleSRSRate = useCallback((rating: SRSRating) => {
    const card = cards[currentIndex];
    if (!card) return;
    updateSRSCard(card.id, rating);
    const isCorrect = rating === 'good' || rating === 'easy';
    setSessionStats(s => ({ studied: s.studied + 1, correct: s.correct + (isCorrect ? 1 : 0) }));

    if (currentIndex < cards.length - 1) {
      goNext();
    } else {
      setSessionDone(true);
    }
  }, [cards, currentIndex, goNext]);

  const handleContextCheck = useCallback(() => {
    const card = cards[currentIndex];
    if (!card) return;
    const isCorrect = contextInput.trim().toLowerCase() === card.word.toLowerCase();
    setContextResult(isCorrect ? 'correct' : 'incorrect');
    setSessionStats(s => ({ studied: s.studied + 1, correct: s.correct + (isCorrect ? 1 : 0) }));
  }, [cards, currentIndex, contextInput]);

  const handleContextNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      goNext();
    } else {
      setSessionDone(true);
    }
  }, [currentIndex, cards.length, goNext]);

  const handleDelete = useCallback((id: string, name: string) => {
    if (!confirm(`Xoá bộ thẻ học "${name}"?`)) return;
    deleteVocabSet(id);
    setSets(loadVocabSets());
    if (selectedSet?.id === id) {
      setSelectedSet(null);
      setCards([]);
    }
  }, [selectedSet]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!selectedSet || !mode || sessionDone) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'contextual' && contextResult === null && document.activeElement === inputRef.current) {
        if (e.key === 'Enter') { e.preventDefault(); handleContextCheck(); }
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'contextual') {
          if (contextResult) handleContextNext();
          else if (!showContextAnswer) setShowContextAnswer(true);
        } else {
          setIsFlipped(f => !f);
        }
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); speakWord(cards[currentIndex]?.word || ''); }
      if (mode === 'srs' && isFlipped) {
        if (e.key === '1') { e.preventDefault(); handleSRSRate('again'); }
        if (e.key === '2') { e.preventDefault(); handleSRSRate('hard'); }
        if (e.key === '3') { e.preventDefault(); handleSRSRate('good'); }
        if (e.key === '4') { e.preventDefault(); handleSRSRate('easy'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSet, mode, sessionDone, isFlipped, contextResult, showContextAnswer, goPrev, goNext, handleSRSRate, handleContextCheck, handleContextNext, cards, currentIndex]);

  const ratings: RatingLabel[] = [
    { key: 'again', label: t('flash.again', lang), desc: t('flash.againDesc', lang), color: 'bg-red-500 hover:bg-red-600' },
    { key: 'hard', label: t('flash.hard', lang), desc: t('flash.hardDesc', lang), color: 'bg-amber-500 hover:bg-amber-600' },
    { key: 'good', label: t('flash.good', lang), desc: t('flash.goodDesc', lang), color: 'bg-green-500 hover:bg-green-600' },
    { key: 'easy', label: t('flash.easy', lang), desc: t('flash.easyDesc', lang), color: 'bg-blue-500 hover:bg-blue-600' },
  ];

  // No sets
  if (sets.length === 0 && !selectedSet) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-16 animate-fadeIn">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('flash.noSets', lang)}</h2>
        <p className="text-gray-500 dark:text-gray-400">{t('flash.noSetsDesc', lang)}</p>
        <button onClick={() => navigate('/create/vocab')} className="bg-linear-to-r from-indigo-600 to-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium hover:from-indigo-700 hover:to-indigo-600 transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25">
          {t('hub.vocab', lang)}
        </button>
      </div>
    );
  }

  // Set selection
  if (!selectedSet) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn overflow-hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('flash.title', lang)}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('flash.selectSet', lang)}</p>
        </div>
        <div className="grid gap-4">
          {sets.map((vs, i) => {
            const stats = getSRSStats(vs.items);
            return (
              <div key={vs.id} className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-center justify-between gap-3 overflow-hidden hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-lg hover:scale-[1.01] transition-all animate-fadeIn stagger-${Math.min(i + 1, 5)}`}>
                <div className="min-w-0 flex-1 cursor-pointer overflow-hidden" onClick={() => handleSelectSet(vs)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate">{vs.name}</h3>
                    {vs.category && vs.category !== 'general' && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 truncate max-w-24">
                        {CATEGORIES.find(c => c.key === vs.category)?.icon} {getCategoryLabel(vs.category, lang)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                      {vs.items.length} {t('vocab.items', lang)}
                    </span>
                    {stats.newCount > 0 && <span className="text-blue-500">{stats.newCount} {t('flash.new', lang)}</span>}
                    {stats.learningCount > 0 && <span className="text-amber-500">{stats.learningCount} {t('flash.learning', lang)}</span>}
                    {stats.masteredCount > 0 && <span className="text-green-500">{stats.masteredCount} {t('flash.mastered', lang)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => navigate('/create/vocab', { state: { vocabSet: vs } })}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all hover:scale-110 active:scale-95"
                    title="Sửa"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(vs.id, vs.name)}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 active:scale-95"
                    title="Xoá"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mode selection
  if (!mode) {
    const srsStats = getSRSStats(selectedSet.items);
    const dueCards = getDueCards(selectedSet.items);
    const contextualCards = selectedSet.items.filter(hasExampleWithWord);
    const modes: { key: StudyMode; icon: string; label: string; desc: string; count?: number; color: string }[] = [
      { key: 'normal', icon: '📖', label: t('flash.modeNormal', lang), desc: t('flash.modeNormalDesc', lang), count: selectedSet.items.length, color: 'border-indigo-200 dark:border-indigo-700 hover:border-indigo-400' },
      { key: 'reverse', icon: '🔄', label: t('flash.modeReverse', lang), desc: t('flash.modeReverseDesc', lang), count: selectedSet.items.length, color: 'border-cyan-200 dark:border-cyan-700 hover:border-cyan-400' },
      { key: 'contextual', icon: '✏️', label: t('flash.modeContext', lang), desc: t('flash.modeContextDesc', lang), count: contextualCards.length, color: 'border-amber-200 dark:border-amber-700 hover:border-amber-400' },
      { key: 'srs', icon: '🧠', label: t('flash.modeSRS', lang), desc: t('flash.modeSRSDesc', lang), count: dueCards.length, color: 'border-green-200 dark:border-green-700 hover:border-green-400' },
    ];

    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fadeIn overflow-hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedSet(null)} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all">
            ←
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedSet.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('flash.selectMode', lang)}</p>
          </div>
        </div>

        {/* SRS Stats */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('flash.stats', lang)}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-500">{srsStats.newCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('flash.new', lang)}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{srsStats.learningCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('flash.learning', lang)}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-500">{srsStats.reviewCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('flash.review', lang)}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{srsStats.masteredCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('flash.mastered', lang)}</p>
            </div>
          </div>
        </div>

        {/* Mode cards */}
        <div className="grid gap-3">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => startSession(m.key)}
              disabled={m.key === 'srs' && dueCards.length === 0}
              className={`bg-white dark:bg-gray-800 border-2 ${m.color} rounded-xl p-4 text-left hover:shadow-lg hover:scale-[1.01] transition-all disabled:opacity-40 disabled:cursor-not-allowed group`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{m.label}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</p>
                  </div>
                </div>
                {m.count !== undefined && (
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{m.count}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Session complete
  if (sessionDone) {
    const accuracy = sessionStats.studied > 0 ? Math.round((sessionStats.correct / sessionStats.studied) * 100) : 0;
    return (
      <div className="max-w-md mx-auto text-center space-y-8 py-16 animate-fadeIn">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('flash.sessionDone', lang)}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{selectedSet.name}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-2xl font-bold text-indigo-500">{sessionStats.studied}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('flash.cardsStudied', lang)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-500">{accuracy}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-2xl font-bold text-cyan-500">{sessionStats.correct}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('flash.good', lang)}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={handleRestart} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
            {t('flash.restart', lang)}
          </button>
          <button onClick={() => setMode(null)} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
            {t('flash.backToSets', lang)}
          </button>
        </div>
      </div>
    );
  }

  // No due cards for SRS mode
  if (mode === 'srs' && cards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-16 animate-fadeIn">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('flash.noDue', lang)}</h2>
        <p className="text-gray-500 dark:text-gray-400">{t('flash.noDueDesc', lang)}</p>
        <button onClick={() => setMode(null)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95">
          {t('flash.backToSets', lang)}
        </button>
      </div>
    );
  }

  // Flashcard view
  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fadeIn overflow-hidden">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{selectedSet.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t('flash.card', lang)} {currentIndex + 1} {t('flash.of', lang)} {cards.length}
            {mode === 'srs' && <span className="ml-2 text-green-500">SRS</span>}
            {mode === 'reverse' && <span className="ml-2 text-cyan-500">Reverse</span>}
            {mode === 'contextual' && <span className="ml-2 text-amber-500">Context</span>}
          </p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
          {mode !== 'srs' && (
            <button onClick={handleShuffle} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
              {t('flash.shuffle', lang)}
            </button>
          )}
          <button onClick={handleRestart} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
            {t('flash.restart', lang)}
          </button>
          <button onClick={() => setMode(null)} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
            ←
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-linear-to-r from-indigo-500 to-cyan-500 transition-all duration-500 ease-out rounded-full" style={{ width: `${progress}%` }} />
      </div>

      {/* Card */}
      {mode === 'contextual' ? (
        /* Contextual mode: fill in the blank */
        <div className="space-y-4">
          <div
            className={`bg-white dark:bg-gray-800 border-2 rounded-2xl min-h-70 flex flex-col items-center justify-center p-8 text-center transition-all duration-300 overflow-hidden ${
              contextResult === 'correct' ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10' :
              contextResult === 'incorrect' ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10' :
              'border-gray-200 dark:border-gray-700'
            }`}
          >
            {currentCard.example ? (
              <div className="space-y-4 w-full">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('flash.fillBlank', lang)}</p>
                <div className="flex items-start gap-2">
                  <p
                    className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed flex-1"
                    dangerouslySetInnerHTML={{ __html: highlightBlank(currentCard.example, currentCard.word) }}
                  />
                  <SpeakButton word={stripMarkdown(currentCard.example)} className="mt-0.5 shrink-0" />
                </div>
                {currentCard.meaning && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">({currentCard.meaning})</p>
                )}

                {!contextResult && !showContextAnswer && (
                  <div className="flex gap-2 justify-center mt-4">
                    <input
                      ref={inputRef}
                      type="text"
                      value={contextInput}
                      onChange={e => setContextInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleContextCheck(); }}
                      placeholder={t('flash.typeAnswer', lang)}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-48"
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                    <button onClick={handleContextCheck} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all">
                      {t('flash.checkAnswer', lang)}
                    </button>
                  </div>
                )}

                {contextResult === 'correct' && (
                  <div className="mt-4 space-y-2">
                    <p className="text-green-600 dark:text-green-400 font-semibold">{t('flash.correct', lang)}</p>
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{currentCard.word}</p>
                      <SpeakButton word={currentCard.word} />
                    </div>
                    <button onClick={handleContextNext} className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all">
                      {currentIndex < cards.length - 1 ? t('flash.next', lang) : t('flash.restart', lang)}
                    </button>
                  </div>
                )}

                {contextResult === 'incorrect' && (
                  <div className="mt-4 space-y-2">
                    <p className="text-red-600 dark:text-red-400 font-semibold">{t('flash.incorrect', lang)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('flash.correctAnswer', lang)}:</p>
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{currentCard.word}</p>
                      <SpeakButton word={currentCard.word} />
                    </div>
                    <button onClick={handleContextNext} className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all">
                      {currentIndex < cards.length - 1 ? t('flash.next', lang) : t('flash.restart', lang)}
                    </button>
                  </div>
                )}

                {showContextAnswer && !contextResult && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('flash.correctAnswer', lang)}:</p>
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{currentCard.word}</p>
                      <SpeakButton word={currentCard.word} />
                    </div>
                    <button onClick={handleContextNext} className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all">
                      {currentIndex < cards.length - 1 ? t('flash.next', lang) : t('flash.restart', lang)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{currentCard.word}</p>
                <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">{currentCard.meaning}</p>
                {currentCard.vietnamese && (
                  <p className="text-base text-cyan-600 dark:text-cyan-400 font-medium">{currentCard.vietnamese}</p>
                )}
                <p className="text-sm text-gray-400 dark:text-gray-500">{t('flash.noDueDesc', lang)}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Normal / Reverse / SRS mode */
        <div
          className="relative cursor-pointer"
          onClick={() => {
            if (mode === 'srs' && !isFlipped) setIsFlipped(true);
            else setIsFlipped(f => !f);
          }}
          style={{ perspective: '1000px' }}
        >
          <div className={`bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl min-h-70 flex flex-col items-center justify-center p-8 text-center transition-all duration-500 hover:shadow-xl overflow-hidden ${
            isFlipped ? 'border-indigo-300 dark:border-indigo-600 shadow-lg shadow-indigo-500/10' : ''
          }`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {!isFlipped ? (
              // Front
              <div className="space-y-3">
                {mode === 'reverse' ? (
                  // Reverse: show meaning first
                  <>
                    <p className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">{currentCard.meaning}</p>
                    {currentCard.example && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-start gap-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic flex-1" dangerouslySetInnerHTML={{ __html: `"${renderMarkdown(currentCard.example)}"` }} />
                        <SpeakButton word={stripMarkdown(currentCard.example)} className="shrink-0" />
                      </div>
                    )}
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">{t('flash.showWord', lang)}</p>
                  </>
                ) : (
                  // Normal / SRS: show word first
                  <>
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{currentCard.word}</p>
                      <SpeakButton word={currentCard.word} />
                    </div>
                    {currentCard.phonetic && (
                      <p className="text-base text-gray-400 dark:text-gray-500 font-mono">{currentCard.phonetic}</p>
                    )}
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">{t('flash.showMeaning', lang)}</p>
                  </>
                )}
              </div>
            ) : (
              // Back
              <div className="space-y-3">
                {mode === 'reverse' ? (
                  // Reverse back: show word
                  <>
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{currentCard.word}</p>
                      <SpeakButton word={currentCard.word} />
                    </div>
                    {currentCard.phonetic && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 font-mono">{currentCard.phonetic}</p>
                    )}
                    <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">{currentCard.meaning}</p>
                    {currentCard.vietnamese && (
                      <p className="text-base text-cyan-600 dark:text-cyan-400 font-medium">{currentCard.vietnamese}</p>
                    )}
                  </>
                ) : (
                  // Normal / SRS back: show meaning
                  <>
                    <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">{currentCard.meaning}</p>
                    {currentCard.vietnamese && (
                      <p className="text-base text-cyan-600 dark:text-cyan-400 font-medium">{currentCard.vietnamese}</p>
                    )}
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{currentCard.word}</p>
                      <SpeakButton word={currentCard.word} />
                    </div>
                    {currentCard.phonetic && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 font-mono">{currentCard.phonetic}</p>
                    )}
                  </>
                )}
                {currentCard.example && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500">{t('flash.example', lang)}:</p>
                      <SpeakButton word={stripMarkdown(currentCard.example)} className="p-0.5" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic" dangerouslySetInnerHTML={{ __html: `"${renderMarkdown(currentCard.example)}"` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SRS Rating buttons */}
      {mode === 'srs' && isFlipped && (
        <div className="space-y-2">
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">{t('flash.rate', lang)} · <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">S</kbd> phát âm</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ratings.map((r, i) => (
              <button
                key={r.key}
                onClick={() => handleSRSRate(r.key)}
                className={`${r.color} text-white py-3 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95 shadow-md`}
              >
                <span className="block text-lg font-bold">{r.label}</span>
                <span className="block text-xs opacity-80">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation (non-SRS, non-contextual) */}
      {mode !== 'srs' && mode !== 'contextual' && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 -mt-2">
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Space</kbd> lật · <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">S</kbd> phát âm · <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">←</kbd><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">→</kbd> di chuyển
        </p>
      )}
      {mode !== 'srs' && mode !== 'contextual' && (
        <div className="flex items-center justify-between">
          <button onClick={goPrev} disabled={currentIndex === 0}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
            {t('flash.prev', lang)}
          </button>
          <div className="flex gap-1.5 flex-wrap justify-center max-w-50">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIndex(i); setIsFlipped(false); }}
                className={`w-2 h-2 rounded-full transition-all hover:scale-150 ${
                  i === currentIndex ? 'bg-indigo-600 dark:bg-indigo-400 scale-125' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <button onClick={goNext} disabled={currentIndex === cards.length - 1}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
            {t('flash.next', lang)}
          </button>
        </div>
      )}
    </div>
  );
}
