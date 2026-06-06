import { useReducer, useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Question, QuestionSet, UserAnswer, QuizMode } from '../types';
import AnswerOption from '../components/AnswerOption';
import ScoreBoard from '../components/ScoreBoard';
import QuestionReview from '../components/QuestionReview';
import TranslatableText from '../components/TranslatableText';
import { cleanQuestionText, cleanOptionText, saveActiveSet, loadActiveSet, clearActiveSet, addResult, generateId } from '../utils/helpers';
import type { QuestionResult } from '../types';
import { renderMarkdown } from '../utils/markdown';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleQuestionOptions(q: Question): Question {
  const keys = ['A', 'B', 'C', 'D'] as const;
  const entries = keys.map(k => ({ key: k, text: q.options[k] }));
  const shuffled = shuffleArray(entries);
  const newOptions = { A: shuffled[0].text, B: shuffled[1].text, C: shuffled[2].text, D: shuffled[3].text };
  const correctIdx = entries.findIndex(e => e.key === q.correctAnswer);
  const newCorrectAnswer = shuffled[correctIdx].key;
  return { ...q, options: newOptions, correctAnswer: newCorrectAnswer };
}

function cleanQuestionSet(qs: QuestionSet): QuestionSet {
  return {
    ...qs,
    examTimeLimit: qs.examTimeLimit ?? 30,
    shuffleAnswers: qs.shuffleAnswers ?? false,
    questions: qs.questions.map(q => ({
      ...q,
      questionText: cleanQuestionText(q.questionText),
      options: {
        A: cleanOptionText(q.options.A),
        B: cleanOptionText(q.options.B),
        C: cleanOptionText(q.options.C),
        D: cleanOptionText(q.options.D),
      },
    })),
  };
}

interface State {
  questionSet: QuestionSet | null;
  answers: Record<string, UserAnswer>;
  currentIndex: number;
  viewMode: 'single' | 'all';
  isFinished: boolean;
  mode: QuizMode | null;
  startTime: number | null;
  finishedAt: number | null;
}

type Action =
  | { type: 'LOAD_SET'; payload: QuestionSet }
  | { type: 'SET_MODE'; payload: QuizMode }
  | { type: 'UPDATE_SET_SETTINGS'; payload: { examTimeLimit?: number; shuffleAnswers?: boolean } }
  | { type: 'SELECT_ANSWER'; payload: { questionId: string; answer: 'A' | 'B' | 'C' | 'D' } }
  | { type: 'CHECK_ANSWER'; payload: { questionId: string } }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GO_TO'; payload: number }
  | { type: 'TOGGLE_VIEW_MODE' }
  | { type: 'SHUFFLE'; payload: { shuffleAnswers: boolean } }
  | { type: 'FINISH' }
  | { type: 'TIME_UP' }
  | { type: 'RESET' };

function initAnswers(questions: Question[]): Record<string, UserAnswer> {
  const answers: Record<string, UserAnswer> = {};
  for (const q of questions) {
    answers[q.id] = { questionId: q.id, selectedAnswer: null, isRevealed: false };
  }
  return answers;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_SET': {
      const cleaned = cleanQuestionSet(action.payload);
      saveActiveSet(cleaned);
      return {
        questionSet: cleaned,
        answers: initAnswers(cleaned.questions),
        currentIndex: 0,
        viewMode: 'single',
        isFinished: false,
        mode: null,
        startTime: null,
        finishedAt: null,
      };
    }
    case 'SET_MODE':
      return { ...state, mode: action.payload, startTime: Date.now() };
    case 'UPDATE_SET_SETTINGS': {
      if (!state.questionSet) return state;
      const updated = { ...state.questionSet, ...action.payload };
      saveActiveSet(updated);
      return { ...state, questionSet: updated };
    }
    case 'SELECT_ANSWER': {
      const existing = state.answers[action.payload.questionId];
      if (existing?.isRevealed) return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.questionId]: { ...existing, selectedAnswer: action.payload.answer },
        },
      };
    }
    case 'CHECK_ANSWER': {
      const existing = state.answers[action.payload.questionId];
      if (!existing?.selectedAnswer) return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.questionId]: { ...existing, isRevealed: true },
        },
      };
    }
    case 'NEXT':
      if (!state.questionSet) return state;
      return { ...state, currentIndex: Math.min(state.currentIndex + 1, state.questionSet.questions.length - 1) };
    case 'PREV':
      return { ...state, currentIndex: Math.max(state.currentIndex - 1, 0) };
    case 'GO_TO':
      if (!state.questionSet) return state;
      return { ...state, currentIndex: Math.max(0, Math.min(action.payload, state.questionSet.questions.length - 1)) };
    case 'TOGGLE_VIEW_MODE':
      return { ...state, viewMode: state.viewMode === 'single' ? 'all' : 'single' };
    case 'SHUFFLE': {
      if (!state.questionSet) return state;
      let shuffled = shuffleArray(state.questionSet.questions);
      if (action.payload.shuffleAnswers) {
        shuffled = shuffled.map(q => shuffleQuestionOptions(q));
      }
      const newSet = { ...state.questionSet, questions: shuffled };
      saveActiveSet(newSet);
      return {
        ...state,
        questionSet: newSet,
        answers: initAnswers(shuffled),
        currentIndex: 0,
        isFinished: false,
      };
    }
    case 'FINISH':
    case 'TIME_UP': {
      const answers = { ...state.answers };
      for (const key of Object.keys(answers)) {
        answers[key] = { ...answers[key], isRevealed: true };
      }
      return { ...state, answers, isFinished: true, finishedAt: Date.now() };
    }
    case 'RESET':
      if (!state.questionSet) return state;
      return {
        ...state,
        answers: initAnswers(state.questionSet.questions),
        currentIndex: 0,
        isFinished: false,
        mode: null,
        startTime: null,
      };
    default:
      return state;
  }
}

const initialState: State = {
  questionSet: null, answers: {}, currentIndex: 0, viewMode: 'single', isFinished: false, mode: null, startTime: null, finishedAt: null,
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const timeOptions = [0, 10, 15, 20, 30, 45, 60, 90, 120];

export default function Quiz() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const lang = settings.language;
  const [state, dispatch] = useReducer(reducer, initialState);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const qs = (location.state as { questionSet?: QuestionSet } | null)?.questionSet;
    if (qs) {
      dispatch({ type: 'LOAD_SET', payload: qs });
    } else {
      const saved = loadActiveSet();
      if (saved) dispatch({ type: 'LOAD_SET', payload: saved });
    }
  }, [location.state]);

  // Save result on finish
  useEffect(() => {
    if (!state.isFinished || !state.questionSet || !state.mode) return;
    const { questionSet, answers, mode, startTime } = state;
    const questionResults: QuestionResult[] = questionSet.questions.map(q => {
      const a = answers[q.id];
      return {
        questionId: q.id, questionText: cleanQuestionText(q.questionText),
        selectedAnswer: a?.selectedAnswer ?? null, correctAnswer: q.correctAnswer,
        isCorrect: a?.selectedAnswer === q.correctAnswer,
      };
    });
    const correct = questionResults.filter(r => r.isCorrect).length;
    const timeSpent = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;
    addResult({
      id: generateId(), setId: questionSet.id, setName: questionSet.name,
      date: new Date().toISOString(), score: { correct, total: questionSet.questions.length },
      questionResults, mode, timeSpent,
    });
  }, [state.isFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer for exam mode
  useEffect(() => {
    const examTimeLimit = state.questionSet?.examTimeLimit ?? 0;
    if (state.mode !== 'exam' || state.isFinished || examTimeLimit === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const totalSeconds = examTimeLimit * 60;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(totalSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          dispatch({ type: 'TIME_UP' });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.mode, state.isFinished, state.questionSet?.examTimeLimit]);

  const handleStartMode = useCallback((mode: QuizMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!state.mode || state.isFinished || !state.questionSet) return;
    if (state.viewMode === 'all') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const keyMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
        '1': 'A', '2': 'B', '3': 'C', '4': 'D',
        'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D',
      };

      const currentQ = state.questionSet!.questions[state.currentIndex];
      const currentAnswer = state.answers[currentQ.id];
      const isExam = state.mode === 'exam';

      if (keyMap[e.key]) {
        e.preventDefault();
        const answer = keyMap[e.key];

        if (currentAnswer?.isRevealed) return;

        dispatch({ type: 'SELECT_ANSWER', payload: { questionId: currentQ.id, answer } });

        if (isExam) {
          // Exam: auto-advance after selecting
          setTimeout(() => {
            dispatch({ type: 'NEXT' });
          }, 150);
        } else {
          // Study: auto-check after selecting
          if (!currentAnswer?.isRevealed) {
            setTimeout(() => {
              dispatch({ type: 'CHECK_ANSWER', payload: { questionId: currentQ.id } });
            }, 100);
          }
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (!isExam && currentAnswer?.isRevealed) {
          dispatch({ type: 'NEXT' });
        }
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        dispatch({ type: 'NEXT' });
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        dispatch({ type: 'PREV' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.mode, state.isFinished, state.questionSet, state.currentIndex, state.answers, state.viewMode]);

  // Translation enabled for study mode + english category
  const isEnglishStudy = state.mode === 'study' && state.questionSet?.category === 'english';

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as QuestionSet;
        if (data.questions?.length > 0) dispatch({ type: 'LOAD_SET', payload: data });
      } catch { /* */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // No question set loaded
  if (!state.questionSet) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-12 animate-fadeIn">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('quiz.noSet', lang)}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('quiz.importOr', lang)}</p>
        <label className="block">
          <span className="bg-linear-to-r from-indigo-600 to-indigo-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-600 cursor-pointer inline-block transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25">{t('quiz.import', lang)}</span>
          <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
        </label>
        <button onClick={() => navigate('/create')} className="block w-full border-2 border-cyan-200 dark:border-cyan-700/50 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all hover:scale-[1.02] active:scale-[0.98]">{t('quiz.create', lang)}</button>
      </div>
    );
  }

  const { questionSet, answers, currentIndex, viewMode, isFinished, mode } = state;
  const questions = questionSet.questions;
  const correct = Object.values(answers).filter(a => a.isRevealed && questions.find(q => q.id === a.questionId)?.correctAnswer === a.selectedAnswer).length;
  const incorrect = Object.values(answers).filter(a => a.isRevealed && a.selectedAnswer && questions.find(q => q.id === a.questionId)?.correctAnswer !== a.selectedAnswer).length;

  // Mode selection screen
  if (!mode) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-8 py-12 animate-fadeIn">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{questionSet.name}</h1>
          <p className="text-gray-500 dark:text-gray-400">{questions.length} {t('sets.questions', lang)}</p>
        </div>

        {/* Per-set settings */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-left space-y-5 animate-scaleIn">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{t('settings.title', lang)}</h3>

          {/* Exam time limit */}
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">{t('settings.examTime', lang)}</label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {timeOptions.map(min => (
                <button
                  key={min}
                  onClick={() => dispatch({ type: 'UPDATE_SET_SETTINGS', payload: { examTimeLimit: min } })}
                  className={`py-2 rounded-lg text-xs font-medium border-2 transition-all hover:scale-105 active:scale-95 ${
                    questionSet.examTimeLimit === min
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  {min === 0 ? t('settings.noLimit', lang) : `${min}m`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={180}
                step={5}
                value={questionSet.examTimeLimit}
                onChange={e => dispatch({ type: 'UPDATE_SET_SETTINGS', payload: { examTimeLimit: Number(e.target.value) } })}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 w-14 text-right">
                {questionSet.examTimeLimit === 0 ? '∞' : `${questionSet.examTimeLimit}m`}
              </span>
            </div>
          </div>

          {/* Shuffle answers */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.shuffleAnswers', lang)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.shuffleDesc', lang)}</p>
            </div>
            <button
              onClick={() => dispatch({ type: 'UPDATE_SET_SETTINGS', payload: { shuffleAnswers: !questionSet.shuffleAnswers } })}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                questionSet.shuffleAnswers ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform" style={{ transform: questionSet.shuffleAnswers ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('quiz.modeSelect', lang)}</h2>
        <div className="grid gap-4">
          <button
            onClick={() => handleStartMode('exam')}
            className="bg-linear-to-r from-red-600 to-red-500 text-white py-5 rounded-xl font-semibold hover:from-red-700 hover:to-red-600 transition-all text-left px-6 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] shadow-md shadow-red-500/20 animate-scaleIn stagger-1"
          >
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-lg">{t('quiz.examMode', lang)}</p>
                <p className="text-sm font-normal opacity-80">{t('quiz.examDesc', lang)}</p>
                {questionSet.examTimeLimit > 0 && (
                  <p className="text-sm font-normal opacity-80 mt-1">{t('quiz.timeLimit', lang, { n: questionSet.examTimeLimit })}</p>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => handleStartMode('study')}
            className="bg-linear-to-r from-indigo-600 to-indigo-500 text-white py-5 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-600 transition-all text-left px-6 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] shadow-md shadow-indigo-500/20 animate-scaleIn stagger-2"
          >
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div>
                <p className="text-lg">{t('quiz.studyMode', lang)}</p>
                <p className="text-sm font-normal opacity-80">{t('quiz.studyDesc', lang)}</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  const isExam = mode === 'exam';

  const renderQuestion = (q: Question, idx: number) => {
    const answer = answers[q.id];
    const canCheck = !isExam && answer?.selectedAnswer && !answer.isRevealed;
    return (
      <div key={q.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all animate-scaleIn">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          <span className="text-indigo-600 dark:text-indigo-400 mr-1">Câu {idx + 1}:</span>
          <TranslatableText html={renderMarkdown(q.questionText)} enabled={isEnglishStudy} />
          {isEnglishStudy && (
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal select-none">
              <svg className="w-3.5 h-3.5 inline mr-0.5 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {t('translate.tapToTranslate', lang)}
            </span>
          )}
        </h3>
        <div className="space-y-2 mb-4">
          {(['A', 'B', 'C', 'D'] as const).map(letter => (
            <AnswerOption key={letter} letter={letter} text={q.options[letter]}
              selected={answer?.selectedAnswer === letter} correctAnswer={q.correctAnswer}
              isRevealed={answer?.isRevealed || false}
              translatable={isEnglishStudy}
              onSelect={() => dispatch({ type: 'SELECT_ANSWER', payload: { questionId: q.id, answer: letter } })}
            />
          ))}
        </div>
        {canCheck && (
          <button onClick={() => dispatch({ type: 'CHECK_ANSWER', payload: { questionId: q.id } })}
            className="bg-linear-to-r from-amber-500 to-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-amber-600 hover:to-amber-700 transition-all hover:scale-105 active:scale-95 shadow-md shadow-amber-500/25">
            {t('quiz.check', lang)}
          </button>
        )}
        {answer?.isRevealed && q.explanation && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-900 dark:text-amber-200 mt-3 animate-scaleIn"
            dangerouslySetInnerHTML={{ __html: `<strong>${t('quiz.explain', lang)}</strong> ` + renderMarkdown(q.explanation) }}
          />
        )}
      </div>
    );
  };

  // Finished
  if (isFinished) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{questionSet.name}</h1>
          <div className="flex gap-2">
            <button onClick={() => dispatch({ type: 'RESET' })} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline transition-colors">{t('quiz.redo', lang)}</button>
            <button onClick={() => { clearActiveSet(); navigate(0); }} className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{t('quiz.deleteSaved', lang)}</button>
          </div>
        </div>
        {state.startTime && state.finishedAt && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('quiz.timeRemaining', lang)}: {formatTime(Math.round((state.finishedAt - state.startTime) / 1000))}
          </p>
        )}
        <ScoreBoard correct={correct} incorrect={incorrect} total={questions.length} />
        <QuestionReview questions={questions} answers={answers} />
        <button onClick={() => navigate('/')} className="w-full border-2 border-gray-300 dark:border-gray-600 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all hover:scale-[1.01] active:scale-[0.99]">{t('quiz.home', lang)}</button>
      </div>
    );
  }

  // Active quiz
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{questionSet.name}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{questions.length} {t('sets.questions', lang)}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${isExam ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'}`}>
              {isExam ? t('quiz.examMode', lang) : t('quiz.studyMode', lang)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExam && timeLeft !== null && questionSet.examTimeLimit > 0 && (
            <span className={`text-sm font-mono font-bold px-3 py-1.5 rounded-lg transition-colors ${timeLeft < 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse-soft' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
              {formatTime(timeLeft)}
            </span>
          )}
          {!isExam && (
            <button onClick={() => dispatch({ type: 'TOGGLE_VIEW_MODE' })}
              className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
              {viewMode === 'single' ? t('quiz.viewAll', lang) : t('quiz.perQuestion', lang)}
            </button>
          )}
          <button onClick={() => dispatch({ type: 'FINISH' })}
            className="text-sm px-3 py-1.5 bg-linear-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25">
            {t('quiz.submit', lang)}
          </button>
        </div>
      </div>

      {!isExam && <ScoreBoard correct={correct} incorrect={incorrect} total={questions.length} />}

      {/* Question navigation list */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {questions.map((q, i) => {
            const ans = answers[q.id];
            const isActive = i === currentIndex;
            const hasAnswer = !!ans?.selectedAnswer;
            const isRevealed = ans?.isRevealed;
            const isCorrect = isRevealed && ans?.selectedAnswer === q.correctAnswer;
            const isWrong = isRevealed && hasAnswer && !isCorrect;

            let btnClass = 'w-9 h-9 rounded-lg text-xs font-bold border-2 transition-all hover:scale-110 active:scale-95 ';

            if (isActive) {
              btnClass += 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-110';
            } else if (isExam) {
              btnClass += hasAnswer
                ? 'border-cyan-400 dark:border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500';
            } else if (isCorrect) {
              btnClass += 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300';
            } else if (isWrong) {
              btnClass += 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300';
            } else {
              btnClass += 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500';
            }

            return (
              <button
                key={q.id}
                onClick={() => dispatch({ type: 'GO_TO', payload: i })}
                className={btnClass}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {isExam || viewMode === 'single' ? (
        <>
          {renderQuestion(questions[currentIndex], currentIndex)}
          <div className="flex items-center justify-between">
            <button onClick={() => dispatch({ type: 'PREV' })} disabled={currentIndex === 0}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
              {t('quiz.prev', lang)}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">{currentIndex + 1} / {questions.length}</span>
            <button onClick={() => dispatch({ type: 'NEXT' })} disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
              {t('quiz.next', lang)}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => renderQuestion(q, i))}
        </div>
      )}
    </div>
  );
}
