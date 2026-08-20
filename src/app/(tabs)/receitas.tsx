import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import RecipesTab from '@/components/recipe/RecipesTab';
import MaterialsTab from '@/components/recipe/MaterialsTab';

type TabKey = 'receitas' | 'materiais';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'receitas', label: 'Receitas', icon: 'restaurant-outline' },
  { key: 'materiais', label: 'Materiais', icon: 'cube-outline' },
];

const VALID_TABS = new Set<TabKey>(['receitas', 'materiais']);

export default function ReceitasScreen() {
  const theme = useTheme();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>(
    initialTab && VALID_TABS.has(initialTab as TabKey) ? (initialTab as TabKey) : 'receitas',
  );

  useEffect(() => {
    if (initialTab && VALID_TABS.has(initialTab as TabKey)) {
      setTab(initialTab as TabKey);
    }
  }, [initialTab]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Receitas</ThemedText>
          <ThemedText style={styles.subtitle}>Fichas técnicas e materiais</ThemedText>
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.tabButton,
                  active && { borderBottomColor: theme.primary },
                ]}
              >
                <Ionicons
                  name={t.icon}
                  size={18}
                  color={active ? theme.primary : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: active ? theme.primary : theme.textSecondary },
                  ]}
                >
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.content}>
          {tab === 'receitas' && <RecipesTab onRequestMaterials={() => setTab('materiais')} />}
          {tab === 'materiais' && <MaterialsTab />}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
});
