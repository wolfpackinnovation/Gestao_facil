import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/contexts/theme-mode';

export default function ConfiguracaoScreen() {
  const { themeMode, resolvedTheme, toggleTheme } = useThemeMode();

  const isDark = resolvedTheme === 'dark';
  const label =
    themeMode === 'system' ? 'Sistema' : themeMode === 'dark' ? 'Escuro' : 'Claro';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText style={styles.emoji}>⚙️</ThemedText>
          <ThemedText type="title" style={styles.title}>
            Configuração
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Aparência
          </ThemedText>

          <Pressable onPress={toggleTheme} style={styles.themeRow}>
            <SymbolView
              tintColor={isDark ? '#fbbf24' : '#6b7280'}
              name={{ ios: isDark ? 'sun.max.fill' : 'moon.fill', web: 'light' }}
              size={24}
            />
            <ThemedView style={styles.themeText}>
              <ThemedText type="default">Tema</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
            </ThemedView>
            <SymbolView
              tintColor="#9ca3af"
              name={{ ios: 'chevron.right', web: 'link' }}
              size={16}
            />
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  emoji: {
    fontSize: 64,
  },
  section: {
    alignSelf: 'stretch',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  themeText: {
    flex: 1,
    gap: Spacing.half,
  },
});
