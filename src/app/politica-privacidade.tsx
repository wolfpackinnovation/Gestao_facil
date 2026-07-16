import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PoliticaPrivacidadeScreen() {
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
          <ThemedText style={styles.topTitle}>Política de Privacidade</ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedText style={styles.title}>Política de Privacidade</ThemedText>
          <ThemedText style={styles.lastUpdate}>Última atualização: Julho de 2026</ThemedText>

          <ThemedText style={styles.section}>
            <ThemedText style={styles.subtitle}>1. Coleta de Dados</ThemedText>
            {'\n\n'}
            Coletamos as seguintes informações pessoais para o funcionamento do GestFacil:
            {'\n'}• Nome e e-mail do usuário
            {'\n'}• Dados de acesso (senha criptografada)
            {'\n'}• Informações da empresa (nome, CNPJ, telefone)
            {'\n'}• Dados de clientes, produtos e vendas registrados no sistema
            {'\n'}• Informações financeiras necessárias para relatórios e gestão
          </ThemedText>

          <ThemedText style={styles.section}>
            <ThemedText style={styles.subtitle}>2. Uso dos Dados</ThemedText>
            {'\n\n'}
            Os dados coletados são utilizados exclusivamente para:
            {'\n'}• Operação e funcionamento do sistema GestFacil
            {'\n'}• Geração de relatórios e análises internas
            {'\n'}• Suporte ao usuário
            {'\n'}• Melhorias no serviço
            {'\n'}• Comunicações relacionadas ao serviço (avisos, atualizações)
          </ThemedText>

          <ThemedText style={styles.section}>
            <ThemedText style={styles.subtitle}>3. Armazenamento e Segurança</ThemedText>
            {'\n\n'}
            Seus dados são armazenados em servidores seguros com criptografia em trânsito e em repouso. Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta, os dados são removidos em até 90 dias.
          </ThemedText>

          <ThemedText style={styles.section}>
            <ThemedText style={styles.subtitle}>4. Compartilhamento de Dados</ThemedText>
            {'\n\n'}
            Não compartilhamos seus dados pessoais com terceiros, exceto:
            {'\n'}• Quando exigido por lei ou ordem judicial
            {'\n'}• Com prestadores de serviço essenciais ao funcionamento (hospedagem, autenticação), que são contratualmente obrigados a proteger os dados
          </ThemedText>

          <ThemedText style={styles.section}>
            <ThemedText style={styles.subtitle}>5. Direitos do Usuário</ThemedText>
            {'\n\n'}
            Você tem direito a:
            {'\n'}• Acessar seus dados pessoais
            {'\n'}• Solicitar correção de dados incorretos
            {'\n'}• Solicitar exclusão dos dados
            {'\n'}• Exportar seus dados em formato legível
            {'\n'}• Revogar consentimento a qualquer momento
            {'\n\n'}
            Para exercer seus direitos, entre em contato: privacidade@gestfacil.com.br
          </ThemedText>

          <ThemedText style={styles.section}>
            <ThemedText style={styles.subtitle}>6. Alterações nesta Política</ThemedText>
            {'\n\n'}
            Podemos atualizar esta política periodicamente. Notificaremos os usuários sobre mudanças significativas por e-mail ou no próprio aplicativo.
          </ThemedText>

          <ThemedText style={styles.section}>
            <ThemedText style={styles.subtitle}>7. Contato</ThemedText>
            {'\n\n'}
            Para questões sobre privacidade e proteção de dados:
            {'\n'}• E-mail: privacidade@gestfacil.com.br
            {'\n'}• Endereço: [Inserir endereço da empresa]
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
  section: {
    fontSize: 14,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '700',
  },
});
