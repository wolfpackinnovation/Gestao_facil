import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TermosDeUsoScreen() {
  const router = useRouter();
  const theme = useTheme();
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
          <ThemedText style={styles.topTitle}>Termos de Uso</ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedText style={styles.title}>Termos de Uso</ThemedText>
          <ThemedText style={styles.lastUpdate}>Última atualização: Julho de 2026</ThemedText>

          <ThemedText style={styles.paragraph}>
            <ThemedText style={styles.subtitle}>1. Aceitação dos Termos</ThemedText>
            {'\n\n'}
            Ao utilizar o GestFacil, você concorda com estes Termos de Uso. Se não concordar, não utilize o aplicativo.
          </ThemedText>

          <ThemedText style={styles.paragraph}>
            <ThemedText style={styles.subtitle}>2. Conta de Usuário</ThemedText>
            {'\n\n'}
            Você é responsável por manter a confidencialidade de seus dados de acesso e por todas as atividades realizadas em sua conta.
          </ThemedText>

          <ThemedText style={styles.paragraph}>
            <ThemedText style={styles.subtitle}>3. Uso do Serviço</ThemedText>
            {'\n\n'}
            O GestFacil concede uma licença limitada para uso do software de acordo com o plano contratado. É proibido reproduzir, distribuir ou modificar o software sem autorização.
          </ThemedText>

          <ThemedText style={styles.paragraph}>
            <ThemedText style={styles.subtitle}>4. Privacidade dos Dados</ThemedText>
            {'\n\n'}
            Seus dados são armazenados de forma segura e não são compartilhados com terceiros sem seu consentimento. Consulte nossa Política de Privacidade para mais detalhes.
          </ThemedText>

          <ThemedText style={styles.paragraph}>
            <ThemedText style={styles.subtitle}>5. Limitação de Responsabilidade</ThemedText>
            {'\n\n'}
            O GestFacil não se responsabiliza por danos indiretos decorrentes do uso do aplicativo. O serviço é fornecido "como está".
          </ThemedText>

          <ThemedText style={styles.paragraph}>
            <ThemedText style={styles.subtitle}>6. Alterações nos Termos</ThemedText>
            {'\n\n'}
            Podemos alterar estes termos a qualquer momento. O uso continuado do aplicativo após alterações constitui aceitação dos novos termos.
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
  lastUpdate: {
    fontSize: 13,
    opacity: 0.5,
    marginTop: -Spacing.two,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
  },
});
