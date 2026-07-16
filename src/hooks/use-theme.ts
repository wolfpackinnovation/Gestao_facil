import { useThemeContext } from '@/contexts/theme';

export function useTheme() {
  const { colors } = useThemeContext();
  return colors;
}
