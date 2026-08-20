import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency } from '@/utils/format';

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartão: 'Cartão',
  cartao: 'Cartão',
  fiado: 'Fiado',
};

interface IssueItem {
  name: string;
  unit: string;
  estoqueAtual: number;
  status: 'out' | 'low';
}

export default function VendaSucessoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    number?: string;
    total?: string;
    paymentMethod?: string;
    itemsCount?: string;
    issues?: string;
    from?: string;
  }>();

  const saleNumber = params.number ?? '';
  const total = Number(params.total ?? 0);
  const paymentMethod = params.paymentMethod ?? '';
  const itemsCount = Number(params.itemsCount ?? 0);
  const issues: IssueItem[] = (() => {
    try {
      return params.issues ? JSON.parse(params.issues) : [];
    } catch {
      return [];
    }
  })();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const warningsAnim = useRef(new Animated.Value(0)).current;
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim]);

  useEffect(() => {
    if (issues.length === 0) return;
    const timer = setTimeout(() => {
      setShowWarnings(true);
      Animated.timing(warningsAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 1500);
    return () => clearTimeout(timer);
  }, [issues.length, warningsAnim]);

  function handleFinish() {
    const target = params.from ?? '/(tabs)/vendas';
    router.dismissAll();
    router.navigate(target as any);
  }

  const paymentLabel = PAYMENT_LABELS[paymentMethod] ?? paymentMethod;
  const esgotados = issues.filter((i) => i.status === 'out');
  const baixos = issues.filter((i) => i.status === 'low');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.checkCircle,
              {
                backgroundColor: '#22c55e',
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons name="checkmark" size={56} color="#ffffff" />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', gap: Spacing.one }}>
            <ThemedText style={styles.title}>Venda concluída!</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {saleNumber}
            </ThemedText>
          </Animated.View>

          <Animated.View style={[styles.summaryCard, { opacity: fadeAnim }]}>
            <ThemedView style={styles.summaryRow}>
              <ThemedText type="small" themeColor="textSecondary">Total</ThemedText>
              <ThemedText style={styles.summaryValue}>{formatCurrency(total)}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.divider} />
            <ThemedView style={styles.summaryRow}>
              <ThemedText type="small" themeColor="textSecondary">Pagamento</ThemedText>
              <ThemedText style={styles.summaryValue}>{paymentLabel}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.divider} />
            <ThemedView style={styles.summaryRow}>
              <ThemedText type="small" themeColor="textSecondary">Itens</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
              </ThemedText>
            </ThemedView>
          </Animated.View>

          {showWarnings && issues.length > 0 && (
            <Animated.View style={[styles.warningsCard, { opacity: warningsAnim }]}>
              <View style={styles.warningsHeader}>
                <Ionicons name="alert-circle" size={18} color="#f59e0b" />
                <ThemedText style={styles.warningsTitle}>Atenção ao estoque</ThemedText>
              </View>

              {esgotados.length > 0 && (
                <View style={styles.warningGroup}>
                  <ThemedText type="small" style={styles.warningGroupTitle}>
                    🔴 Esgotado(s)
                  </ThemedText>
                  {esgotados.map((i, idx) => (
                    <ThemedText key={`o-${idx}`} type="small" style={styles.warningItem}>
                      • {i.name}
                    </ThemedText>
                  ))}
                </View>
              )}

              {baixos.length > 0 && (
                <View style={styles.warningGroup}>
                  <ThemedText type="small" style={styles.warningGroupTitle}>
                    ⚠️ Estoque baixo
                  </ThemedText>
                  {baixos.map((i, idx) => (
                    <ThemedText key={`l-${idx}`} type="small" style={styles.warningItem}>
                      • {i.name} ({i.estoqueAtual} {i.unit} restantes)
                    </ThemedText>
                  ))}
                </View>
              )}
            </Animated.View>
          )}
        </View>

        <Pressable
          onPress={handleFinish}
          style={({ pressed }) => [
            styles.finishButton,
            { backgroundColor: theme.primary },
            pressed && { opacity: 0.85 },
          ]}
        >
          <ThemedText style={styles.finishButtonText}>Concluir</ThemedText>
        </Pressable>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.five,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  summaryCard: {
    alignSelf: 'stretch',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryValue: {
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  warningsCard: {
    alignSelf: 'stretch',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  warningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  warningsTitle: {
    fontWeight: '700',
  },
  warningGroup: {
    gap: 2,
  },
  warningGroupTitle: {
    fontWeight: '600',
  },
  warningItem: {
    paddingLeft: Spacing.two,
  },
  finishButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
  finishButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
