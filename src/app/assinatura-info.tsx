import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const plans = [
  {
    name: 'Gratuito',
    price: 'R$ 0,00',
    features: [
      'Até 50 produtos',
      'Até 100 vendas/mês',
      'Relatórios básicos',
      '1 usuário',
    ],
    color: '#9CA3AF',
  },
  {
    name: 'Pro',
    price: 'R$ 29,90/mês',
    features: [
      'Produtos ilimitados',
      'Vendas ilimitadas',
      'Relatórios avançados',
      'Até 3 usuários',
      'Suporte prioritário',
    ],
    color: '#C4956A',
  },
  {
    name: 'Premium',
    price: 'R$ 59,90/mês',
    features: [
      'Tudo do Pro',
      'Integração fiscal (NF-e)',
      'Múltiplos usuários',
      'Exportação de dados',
      'Suporte 24h',
    ],
    color: '#3B82F6',
  },
];

export default function AssinaturaInfoScreen() {
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
          <ThemedText style={styles.topTitle}>Planos</ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          <ThemedText style={styles.title}>Planos</ThemedText>
          <ThemedText style={styles.subtitle}>
            Escolha o plano ideal para seu negócio
          </ThemedText>

          {plans.map((plan) => (
            <ThemedView
              key={plan.name}
              style={[styles.planCard, { borderColor: plan.color }]}
            >
              <ThemedText style={[styles.planName, { color: plan.color }]}>
                {plan.name}
              </ThemedText>
              <ThemedText style={styles.planPrice}>{plan.price}</ThemedText>
              <View style={styles.featuresList}>
                {plan.features.map((feature, i) => (
                  <ThemedText key={i} style={styles.feature}>
                    ✓ {feature}
                  </ThemedText>
                ))}
              </View>
            </ThemedView>
          ))}

          <ThemedText style={styles.footer}>
            Para mais informações sobre planos e preços, acesse nosso site ou entre em contato pelo suporte.
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
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.6,
    marginTop: -Spacing.two,
  },
  planCard: {
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  featuresList: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  feature: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.5,
  },
});
