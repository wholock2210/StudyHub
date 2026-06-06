import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppSettings, Language, Theme } from '../types';
import { loadAppSettings, saveAppSetting } from '../utils/helpers';

function loadSettings(): AppSettings {
  const stored = loadAppSettings();
  return {
    language: (stored.language as Language) ?? 'vi',
    theme: (stored.theme as Theme) ?? 'light',
  };
}

interface SettingsContextType {
  settings: AppSettings;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings]);

  const setLanguage = useCallback((language: Language) => {
    setSettings(prev => {
      const next = { ...prev, language };
      saveAppSetting('language', language);
      return next;
    });
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setSettings(prev => {
      const next = { ...prev, theme };
      saveAppSetting('theme', theme);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, setLanguage, setTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextType {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
