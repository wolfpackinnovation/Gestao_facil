import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SobreAppScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <View style={[styles.topBar, { paddingTop: insets.top }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
          </Pressable>
          <ThemedText style={styles.topTitle}>Sobre o App</ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedView style={styles.header}>
            <ThemedView style={[styles.logo, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'storefront.fill', android: 'storefront', web: 'storefront' }}
                tintColor={theme.primary}
                size={44}
              />
            </ThemedView>

            <ThemedText style={styles.title}>GestFácil</ThemedText>

            <ThemedText style={styles.description}>
              Sistema de gestão para mercados e açougues.
            </ThemedText>

            <ThemedText style={styles.version}>
              Versão 1.0.0
            </ThemedText>
          </ThemedView>

          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.cardTitle}>
              📦 Recursos
            </ThemedText>

            <ThemedText style={styles.item}>• Controle de estoque</ThemedText>
            <ThemedText style={styles.item}>• Registro de vendas</ThemedText>
            <ThemedText style={styles.item}>• Gestão financeira</ThemedText>
            <ThemedText style={styles.item}>• Cadastro de clientes</ThemedText>
            <ThemedText style={styles.item}>• Caixa diário</ThemedText>
            <ThemedText style={styles.item}>• Arquivos fiscais</ThemedText>
            <ThemedText style={styles.item}>• Relatórios</ThemedText>
            <ThemedText style={styles.item}>• Desossa</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.cardTitle}>
              ⚡ Tecnologia
            </ThemedText>

            <ThemedText style={styles.item}>React Native</ThemedText>
            <ThemedText style={styles.item}>Firebase</ThemedText>
            <ThemedText style={styles.item}>Cloud Firestore</ThemedText>
            <ThemedText style={styles.item}>Cloud Functions</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.cardTitle}>
              👨‍💻 Desenvolvido por
            </ThemedText>

            <ThemedText style={styles.item}>
              Wolfpack Innovation
            </ThemedText>
          </ThemedView>

          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.cardTitle}>
              ❤️ Idealização
            </ThemedText>

            <ThemedText style={styles.item}>
              Gisely dos Santos Primo
            </ThemedText>
          </ThemedView>

          <ThemedText style={styles.footer}>
            © 2026 Wolfpack Innovation{'\n'}
            Versão 1.0.0
          </ThemedText>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  description: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
    lineHeight: 22,
  },
  version: {
    marginTop: 12,
    opacity: 0.5,
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  item: {
    fontSize: 15,
    lineHeight: 24,
  },
  footer: {
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.5,
    fontSize: 13,
    lineHeight: 22,
  },
});
