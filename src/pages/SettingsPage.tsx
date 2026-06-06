import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';
import { loadAISettings, saveAISettings, type AISettings } from '../utils/helpers';
import { testAIConnection, type TestResult } from '../utils/aiGenerator';

export default function SettingsPage() {
  const { settings, setLanguage, setTheme } = useSettings();
  const lang = settings.language;

  const [ai, setAi] = useState<AISettings>(() => loadAISettings());
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const updateAI = (patch: Partial<AISettings>) => {
    const next = { ...ai, ...patch };
    setAi(next);
    saveAISettings(next);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testAIConnection(ai);
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title', lang)}</h1>
      </div>

      {/* Language */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">{t('settings.language', lang)}</h2>
        <div className="flex gap-3">
          {(['vi', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`flex-1 py-3 rounded-xl font-medium text-sm border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                settings.language === l
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {l === 'vi' ? '🇻🇳 Tiếng Việt' : '🇺🇸 English'}
            </button>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">{t('settings.theme', lang)}</h2>
        <div className="flex gap-3">
          {(['light', 'dark'] as const).map(th => (
            <button
              key={th}
              onClick={() => setTheme(th)}
              className={`flex-1 py-3 rounded-xl font-medium text-sm border-2 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                settings.theme === th
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {th === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
              {t(th === 'light' ? 'settings.light' : 'settings.dark', lang)}
            </button>
          ))}
        </div>
      </section>

      {/* AI Configuration */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">{t('ai.title', lang)}</h2>

        {/* Provider selector */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">{t('ai.provider', lang)}</label>
          <div className="flex gap-3">
            {(['gemini', 'claude', 'openai'] as const).map(p => (
              <button
                key={p}
                onClick={() => updateAI({ provider: p })}
                className={`flex-1 py-3 rounded-xl font-medium text-sm border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  ai.provider === p
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                {p === 'gemini' ? t('ai.gemini', lang) : p === 'claude' ? t('ai.claude', lang) : t('ai.openai', lang)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {ai.provider === 'gemini' ? t('ai.geminiNote', lang) : ai.provider === 'claude' ? t('ai.claudeNote', lang) : t('ai.openaiNote', lang)}
          </p>
        </div>

        {/* Guided key acquisition */}
        {!ai.apiKey && (
          <div className="mb-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('ai.getKeySteps', lang)}</h3>
            <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 mb-3">
              <p>{t(ai.provider === 'gemini' ? 'ai.step1Gemini' : ai.provider === 'claude' ? 'ai.step1Claude' : 'ai.step1OpenAI', lang)}</p>
              <p>{t(ai.provider === 'gemini' ? 'ai.step2Gemini' : ai.provider === 'claude' ? 'ai.step2Claude' : 'ai.step2OpenAI', lang)}</p>
              <p>{t(ai.provider === 'gemini' ? 'ai.step3Gemini' : ai.provider === 'claude' ? 'ai.step3Claude' : 'ai.step3OpenAI', lang)}</p>
              <p>{t(ai.provider === 'gemini' ? 'ai.step4Gemini' : ai.provider === 'claude' ? 'ai.step4Claude' : 'ai.step4OpenAI', lang)}</p>
            </div>
            <a
              href={
                ai.provider === 'gemini'
                  ? 'https://aistudio.google.com/apikey'
                  : ai.provider === 'claude'
                    ? 'https://console.anthropic.com/settings/keys'
                    : 'https://platform.openai.com/api-keys'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              {t('ai.openProvider', lang)}
            </a>
          </div>
        )}

        {/* OpenAI-specific: Base URL & Model */}
        {ai.provider === 'openai' && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">{t('ai.baseUrl', lang)}</label>
              <input
                type="text"
                value={ai.openaiBaseUrl}
                onChange={e => updateAI({ openaiBaseUrl: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono"
                placeholder={t('ai.baseUrlPlaceholder', lang)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">{t('ai.model', lang)}</label>
              <input
                type="text"
                value={ai.openaiModel}
                onChange={e => updateAI({ openaiModel: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono"
                placeholder={t('ai.modelPlaceholder', lang)}
              />
            </div>
          </div>
        )}

        {/* API Key */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">{t('ai.apiKey', lang)}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={ai.apiKey}
                onChange={e => updateAI({ apiKey: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-16 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder={t('ai.apiKeyPlaceholder', lang)}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1"
              >
                {showKey ? t('ai.hideKey', lang) : t('ai.showKey', lang)}
              </button>
            </div>
            <button
              onClick={handleTest}
              disabled={!ai.apiKey || testing}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {testing ? t('ai.testing', lang) : t('ai.test', lang)}
            </button>
          </div>
          {testResult && (
            <p className={`text-xs mt-2 ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {testResult.ok ? t('ai.testOk', lang) : testResult.message || t('ai.testFail', lang)}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
