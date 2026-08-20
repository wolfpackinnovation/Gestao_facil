import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePremium } from '@/contexts/premium';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

interface PremiumGateProps {
  children: React.ReactNode;
  showBackButton?: boolean;
}

export function PremiumGate({ children, showBackButton = true }: PremiumGateProps) {
  const { isPremium, isLoading } = usePremium();
  const router = useRouter();
  const theme = useTheme();

  if (isLoading) {
    return null;
  }

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <Ionicons name="diamond" size={64} color="#C4956A" />
          <ThemedText type="subtitle" style={styles.title}>Recurso Premium</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
            Este recurso é exclusivo para assinantes premium.
          </ThemedText>

          <ThemedView style={styles.benefitsBox}>
            <ThemedText type="defaultBold" style={styles.benefitsTitle}>Beneficios Premium</ThemedText>

            <View style={styles.benefitItem}>
              <Ionicons name="people" size={24} color={theme.textSecondary} />
              <View style={styles.benefitTextContainer}>
                <ThemedText style={styles.benefitText}>Clientes Ilimitados</ThemedText>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <Ionicons name="cube" size={24} color={theme.textSecondary} />
              <View style={styles.benefitTextContainer}>
                <ThemedText style={styles.benefitText}>Produtos Ilimitados</ThemedText>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <Ionicons name="bar-chart" size={24} color={theme.textSecondary} />
              <View style={styles.benefitTextContainer}>
                <ThemedText style={styles.benefitText}>Relatorios Avancados</ThemedText>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <Ionicons name="document-text" size={24} color={theme.textSecondary} />
              <View style={styles.benefitTextContainer}>
                <ThemedText style={styles.benefitText}>Arquivos Fiscais</ThemedText>
              </View>
            </View>
          </ThemedView>

          <Pressable
            onPress={() => router.push('/assinatura')}
            style={styles.subscribeButton}
          >
            <ThemedText style={styles.subscribeButtonText}>Assinar Premium</ThemedText>
          </Pressable>

          {showBackButton && (
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ThemedText style={styles.backButtonText}>Voltar</ThemedText>
            </Pressable>
          )}
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 300,
  },
  benefitsBox: {
    width: '100%',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  benefitsTitle: {
    marginBottom: Spacing.one,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitText: {
    fontWeight: '600',
  },
  subscribeButton: {
    backgroundColor: '#C4956A',
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  subscribeButtonText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#fff',
  },
  backButton: {
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    width: '100%',
    alignItems: 'center',
  },
  backButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
