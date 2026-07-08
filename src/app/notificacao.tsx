import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function NotificacaoScreen() {
  const router = useRouter();
  const colors = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.backRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'chevron.left', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.heroSection}>
          <ThemedText style={styles.emoji}>🔔</ThemedText>
          <ThemedText type="title" style={styles.title}>
            Notificações
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.placeholder}>
          <ThemedText type="small" themeColor="textSecondary">
            Nenhuma notificação no momento.
          </ThemedText>
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
  backRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingVertical: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
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
  placeholder: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
});
