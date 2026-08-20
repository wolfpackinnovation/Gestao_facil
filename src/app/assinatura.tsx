import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePremium } from '@/contexts/premium';
import { Loading } from '@/utils/loading';

export default function AssinaturaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isPremium, isLoading, activatePremium, clientCount, inventoryCount } = usePremium();

  async function handleActivatePremium() {
    try {
      await activatePremium();
      Alert.alert('Parabéns!', 'Sua conta agora é premium! Aproveite os benefícios.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível ativar o premium. Tente novamente.');
    }
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <Loading />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <View style={styles.content}>
          {isPremium ? <Ionicons name="star" size={64} color="#22c55e" /> : <Ionicons name="diamond" size={64} color="#C4956A" />}
          <ThemedText type="subtitle" style={styles.title}>
            {isPremium ? 'Você é Premium!' : 'Torner-se Premium'}
          </ThemedText>

          {isPremium ? (
            <ThemedView style={styles.statusBox}>
              <ThemedText style={styles.statusText}>Conta Premium Ativa</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statusSubtext}>
                Aproveite clientes e produtos ilimitados
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
                Desbloqueie todos os recursos do GestFacil
              </ThemedText>

              <ThemedView style={styles.benefitsBox}>
                <ThemedText type="defaultBold" style={styles.benefitsTitle}>Benefícios Premium</ThemedText>

                <View style={styles.benefitItem}>
                  <Ionicons name="people" size={24} color={theme.textSecondary} />
                  <View style={styles.benefitTextContainer}>
                    <ThemedText style={styles.benefitText}>Clientes Ilimitados</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Cadastre quantos clientes quiser
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <Ionicons name="cube" size={24} color={theme.textSecondary} />
                  <View style={styles.benefitTextContainer}>
                    <ThemedText style={styles.benefitText}>Produtos Ilimitados</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Sem limites no seu estoque
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <Ionicons name="sparkles" size={24} color={theme.textSecondary} />
                  <View style={styles.benefitTextContainer}>
                    <ThemedText style={styles.benefitText}>Novos Recursos</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Acesso antecipado a novas funcionalidades
                    </ThemedText>
                  </View>
                </View>
              </ThemedView>

              <ThemedView style={styles.currentUsage}>
                <ThemedText type="small" themeColor="textSecondary">
                  Uso atual: {clientCount}/20 clientes • {inventoryCount}/20 produtos
                </ThemedText>
              </ThemedView>

              <Pressable onPress={handleActivatePremium} style={styles.activateButton}>
                <ThemedText style={styles.activateButtonText}>Ativar Premium</ThemedText>
              </Pressable>
            </>
          )}
        </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 300,
  },
  statusBox: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
  },
  statusSubtext: {
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  benefitsBox: {
    width: '100%',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.three,
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
  currentUsage: {
    alignItems: 'center',
  },
  activateButton: {
    backgroundColor: '#C4956A',
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    width: '100%',
    alignItems: 'center',
  },
  activateButtonText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#fff',
  },
});
