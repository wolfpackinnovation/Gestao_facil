import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const sections = [
  {
    id: 'app',
    title: 'Sobre o App',
    content: `O GestFacil é um sistema completo de gestão para açougues e mercados. Com ele, você controla estoque, vendas, clientes, finanças, cortes de carnes e muito mais.

Ideal para pequenos e médios negócios que buscam organizar sua operação de forma simples e eficiente.`,
  },
  {
    id: 'assinatura',
    title: 'Assinatura',
    content: `O GestFacil oferece planos de assinatura para atender diferentes necessidades:

• Plano Gratuito: Acesso básico com funcionalidades essenciais.
• Plano Pro: Recursos avançados, relatórios detalhados e suporte prioritário.
• Plano Premium: Todas as funcionalidades, integrações fiscais e múltiplos usuários.

Para mais informações sobre planos e preços, acesse nosso site ou entre em contato pelo suporte.`,
  },
  {
    id: 'termos',
    title: 'Termos de Uso',
    content: `1. Aceitação dos Termos
Ao utilizar o GestFacil, você concorda com estes Termos de Uso. Se não concordar, não utilize o aplicativo.

2. Conta de Usuário
Você é responsável por manter a confidencialidade de seus dados de acesso e por todas as atividades realizadas em sua conta.

3. Uso do Serviço
O GestFacil concede uma licença limitada para uso do software de acordo com o plano contratado. É proibido reproduzir, distribuir ou modificar o software sem autorização.

4. Privacidade dos Dados
Seus dados são armazenados de forma segura e não são compartilhados com terceiros sem seu consentimento. Consulte nossa Política de Privacidade para mais detalhes.

5. Limitação de Responsabilidade
O GestFacil não se responsabiliza por danos indiretos decorrentes do uso do aplicativo. O serviço é fornecido "como está".

6. Alterações nos Termos
Podemos alterar estes termos a qualquer momento. O uso continuado do aplicativo após alterações constitui aceitação dos novos termos.`,
  },
  {
    id: 'privacidade',
    title: 'Política de Privacidade',
    content: `1. Coleta de Dados
Coletamos as seguintes informações: nome, e-mail, dados de acesso e informações financeiras necessárias para o funcionamento do sistema.

2. Uso dos Dados
Os dados coletados são utilizados exclusivamente para:
• Operação do sistema GestFacil
• Suporte ao usuário
• Melhorias no serviço
• Comunicações relacionadas ao serviço

3. Armazenamento
Seus dados são armazenados em servidores seguros com criptografia. Mantemos seus dados enquanto sua conta estiver ativa.

4. Compartilhamento
Não compartilhamos seus dados com terceiros, exceto quando exigido por lei.

5. Direitos do Usuário
Você pode solicitar a qualquer momento a exclusão de seus dados. Entre em contato pelo e-mail de suporte.

6. Segurança
Adotamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acesso não autorizado.

7. Contato
Para questões sobre privacidade, entre em contato: privacidade@gestfacil.com.br`,
  },
];

export default function SobreScreen() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggle(id: string) {
    setExpanded(expanded === id ? null : id);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedView style={styles.headerSection}>
            <ThemedText style={styles.appName}>GestFacil</ThemedText>
            <ThemedText style={styles.version}>Versão 1.0.0</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.tagline}>
              Gestão completa para seu negócio
            </ThemedText>
          </ThemedView>

          {sections.map((section) => {
            const isOpen = expanded === section.id;
            return (
              <ThemedView key={section.id} style={styles.section}>
                <Pressable
                  onPress={() => toggle(section.id)}
                  style={[styles.sectionHeader, { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                  <ThemedText style={styles.chevron}>{isOpen ? '▲' : '▼'}</ThemedText>
                </Pressable>
                {isOpen && (
                  <ThemedView style={styles.sectionContent}>
                    <ThemedText style={styles.sectionText}>{section.content}</ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            );
          })}
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
    paddingTop: Spacing.four,
  },
  headerSection: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
  },
  version: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.5,
  },
  tagline: {
    fontSize: 14,
    marginTop: Spacing.one,
  },
  section: {
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    opacity: 0.5,
  },
  sectionContent: {
    padding: Spacing.three,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
