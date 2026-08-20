import { useState, useEffect, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemeContext } from '@/contexts/theme';
import { useAuth } from '@/contexts/auth';
import { getSettings, saveSettings, type AppSettings } from '@/services/settings-service';

export default function ConfiguracaoScreen() {
  const theme = useTheme();
  const { toggleTheme, theme: currentTheme } = useThemeContext();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    const s = await getSettings(companyId);
    setSettings(s);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>CONTA</ThemedText>

            <Pressable
              onPress={() => router.push('/perfil')}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText>Editar Perfil</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>APARÊNCIA</ThemedText>

            <Pressable
              onPress={toggleTheme}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText>Tema escuro</ThemedText>
              <View
                style={[
                  styles.toggle,
                  currentTheme === 'dark' && { backgroundColor: theme.primary },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    currentTheme === 'dark' && { transform: [{ translateX: 16 }] },
                  ]}
                />
              </View>
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>PRIVACIDADE E JURÍDICO</ThemedText>

            <Pressable
              onPress={() => router.push('/termos-de-uso')}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText>Termos de Uso</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/politica-privacidade')}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText>Política de Privacidade</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>INFORMAÇÕES</ThemedText>

            <Pressable
              onPress={() => router.push('/sobre-o-app')}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText>Sobre o App</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    paddingTop: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#9CA3AF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
});
