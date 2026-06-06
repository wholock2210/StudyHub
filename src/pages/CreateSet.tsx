import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';
import type { QuestionSet, VocabSet, Category, Language } from '../types';
import { CATEGORIES } from '../types';

const CAT_KEY_MAP: Record<Category, string> = {
  general: 'cat.general',
  english: 'cat.english',
  math: 'cat.math',
  history: 'cat.history',
  geography: 'cat.geography',
  physics: 'cat.physics',
  chemistry: 'cat.chemistry',
  biology: 'cat.biology',
  literature: 'cat.literature',
};

export function getCategoryLabel(key: Category, lang: Language): string {
  const i18nKey = CAT_KEY_MAP[key];
  return i18nKey ? t(i18nKey as Parameters<typeof t>[0], lang) : key;
}

export default function CreateSet() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const lang = settings.language;

  const state = location.state as { questionSet?: QuestionSet; vocabSet?: VocabSet } | null;

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // If editing an existing set, redirect to the appropriate editor
  useEffect(() => {
    if (state?.questionSet) {
      navigate('/create/quiz', { state: { questionSet: state.questionSet }, replace: true });
    } else if (state?.vocabSet) {
      navigate('/create/vocab', { state: { vocabSet: state.vocabSet }, replace: true });
    }
  }, [state, navigate]);

  // Don't flash the hub if we're redirecting
  if (state?.questionSet || state?.vocabSet) return null;

  // Step 1: Category selection
  if (!selectedCategory) {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fadeIn">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('hub.title', lang)}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('hub.selectCategory', lang)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg hover:scale-[1.03] transition-all group"
            >
              <span className="text-3xl block mb-2">{cat.icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {getCategoryLabel(cat.key, lang)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Quiz or Vocab
  const catInfo = CATEGORIES.find(c => c.key === selectedCategory);

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fadeIn">
      <div className="text-center">
        <button
          onClick={() => setSelectedCategory(null)}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-2 inline-block"
        >
          &larr; {t('hub.back', lang)}
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('hub.title', lang)}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {catInfo?.icon} {getCategoryLabel(selectedCategory, lang)}
        </p>
      </div>

      <div className="grid gap-4">
        {/* Quiz Set */}
        <button
          onClick={() => navigate('/create/quiz', { state: { category: selectedCategory } })}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-left hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-xl hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('hub.quiz', lang)}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('hub.quizDesc', lang)}</p>
            </div>
          </div>
        </button>

        {/* Vocab Set */}
        <button
          onClick={() => navigate('/create/vocab', { state: { category: selectedCategory } })}
          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-left hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-xl hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('hub.vocab', lang)}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('hub.vocabDesc', lang)}</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
