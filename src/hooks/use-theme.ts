import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/contexts/theme-mode';

export function useTheme() {
  const { resolvedTheme } = useThemeMode();
  return Colors[resolvedTheme];
}
