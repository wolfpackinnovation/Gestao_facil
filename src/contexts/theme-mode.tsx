import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = '@gestaofacil:themeMode';

type ThemeModeContextType = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextType | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeMode(stored);
      }
      setLoaded(true);
    });
  }, []);

  const persistThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode);
  };

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system'
      ? systemScheme === 'dark' ? 'dark' : 'light'
      : themeMode;

  const toggleTheme = () => {
    persistThemeMode(
      themeMode === 'system' ? 'light' :
      themeMode === 'light' ? 'dark' : 'system'
    );
  };

  return (
    <ThemeModeContext.Provider value={{ themeMode, setThemeMode: persistThemeMode, resolvedTheme, toggleTheme }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
