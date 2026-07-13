import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/contexts/theme-mode';
import { useTheme } from '@/hooks/use-theme';

export default function ConfiguracaoScreen() {
  const { themeMode, resolvedTheme, toggleTheme } = useThemeMode();
  const colors = useTheme();

  const isDark = resolvedTheme === 'dark';
  const label =
    themeMode === 'system' ? 'Sistema' : themeMode === 'dark' ? 'Escuro' : 'Claro';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedView style={styles.headerSection}>
            <ThemedText type="title" style={styles.title}>
              Configuração
            </ThemedText>
          </ThemedView>

          <ThemedText type="smallBold" style={styles.sectionLabel}>
            Aparência
          </ThemedText>

          <ThemedView style={styles.section}>
            <Pressable onPress={toggleTheme} style={styles.row}>
              <ThemedView style={[styles.iconCircle, { backgroundColor: isDark ? '#fbbf24' : '#6b7280' }]}>
                <SymbolView
                  tintColor="#ffffff"
                  name={{ ios: isDark ? 'sun.max.fill' : 'moon.fill', web: 'light' }}
                  size={20}
                />
              </ThemedView>
              <ThemedView style={styles.rowText}>
                <ThemedText type="default">Tema</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {label}
                </ThemedText>
              </ThemedView>
              <SymbolView
                tintColor={colors.textSecondary}
                name={{ ios: 'chevron.right', web: 'link' }}
                size={14}
              />
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    gap: Spacing.one,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  headerSection: {
    paddingVertical: Spacing.four,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  section: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
