import { useState, useEffect } from 'react'
import { StyleSheet, Pressable, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SymbolView } from 'expo-symbols'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useTheme } from '@/hooks/use-theme'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { getClient, deleteClient } from '@/services/client-service'
import type { Client } from '@/types/schema'

export default function ClienteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useTheme()
  const [cliente, setCliente] = useState<Client | null>(null)

  useEffect(() => {
    if (id) {
      getClient(id).then(setCliente)
    }
  }, [id])

  if (!cliente) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Carregando...</ThemedText>
        </SafeAreaView>
      </ThemedView>
    )
  }

  const handleDelete = () => {
    Alert.alert('Excluir Cliente', `Deseja excluir "${cliente.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteClient(cliente.id!)
          router.navigate('/(tabs)/clientes' as any)
        },
      },
    ])
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.backRow}>
          <Pressable onPress={() => router.navigate('/(tabs)/clientes' as any)} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
        </ThemedView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.clientName}>
            {cliente.name}
          </ThemedText>

          <ThemedView style={styles.infoGrid}>
            {cliente.email && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Email</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.email}</ThemedText>
              </ThemedView>
            )}

            {cliente.phone && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Telefone</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.phone}</ThemedText>
              </ThemedView>
            )}

            {cliente.cpfCnpj && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">CPF/CNPJ</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.cpfCnpj}</ThemedText>
              </ThemedView>
            )}

            <ThemedView style={styles.divider} />

            {cliente.address && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Endereço</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.address}</ThemedText>
              </ThemedView>
            )}

            {cliente.city && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Cidade</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>
                  {cliente.city}{cliente.state ? `/${cliente.state}` : ''}
                </ThemedText>
              </ThemedView>
            )}

            {cliente.zipCode && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">CEP</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.zipCode}</ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
          >
            <ThemedText type="default" style={{ color: '#ef4444' }}>
              Excluir Cliente
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  backRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingVertical: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
  },
  clientName: {
    fontSize: 28,
    lineHeight: 32,
  },
  infoGrid: {
    gap: Spacing.three,
  },
  infoItem: {
    gap: Spacing.half,
  },
  infoValue: {
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#cccccc',
    marginVertical: Spacing.one,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
})
