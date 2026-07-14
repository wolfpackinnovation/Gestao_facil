import { useState } from 'react'
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SymbolView } from 'expo-symbols'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  sendEmailVerification,
} from 'firebase/auth'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/hooks/use-theme'
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme'
import { auth } from '@/lib/firebase'

export default function PerfilScreen() {
  const { user, logout } = useAuth()
  const colors = useTheme()
  const router = useRouter()
  const [sendingVerification, setSendingVerification] = useState(false)

  const creationDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('pt-BR')
    : null

  const handleSendVerification = async () => {
    if (!auth.currentUser) return
    setSendingVerification(true)
    try {
      await sendEmailVerification(auth.currentUser)
      Alert.alert('Email enviado', 'Verifique sua caixa de entrada.')
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    } finally {
      setSendingVerification(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.backRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
        </ThemedView>

        <View style={styles.avatarSection}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <ThemedView type="backgroundSelected" style={styles.avatar}>
              <ThemedText type="title" style={styles.avatarText}>
                {user?.email?.charAt(0).toUpperCase() ?? '?'}
              </ThemedText>
            </ThemedView>
          )}
          <ThemedText type="title" style={styles.name}>
            {user?.displayName ?? 'Usuário'}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {user?.email}
          </ThemedText>

          {user?.emailVerified === false && (
            <Pressable
              style={({ pressed }) => [
                styles.verifyButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleSendVerification}
              disabled={sendingVerification}
            >
              {sendingVerification ? (
                <ActivityIndicator size="small" color="#3c87f7" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#3c87f7" />
                  <ThemedText type="small" style={{ color: '#3c87f7' }}>
                    Verificar email
                  </ThemedText>
                </>
              )}
            </Pressable>
          )}
          {user?.emailVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
              <ThemedText type="small" style={{ color: '#27ae60' }}>
                Email verificado
              </ThemedText>
            </View>
          )}
        </View>

        <ThemedView type="backgroundElement" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="small" themeColor="textSecondary">
                Membro desde
              </ThemedText>
              <ThemedText type="default">
                {creationDate ?? '---'}
              </ThemedText>
            </View>
          </View>

          {user?.providerData?.map((provider, index) => (
            <View key={index} style={styles.infoRow}>
              <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <ThemedText type="small" themeColor="textSecondary">
                  Login vinculado
                </ThemedText>
                <ThemedText type="default">
                  {provider.providerId === 'google.com' ? 'Google' : provider.providerId}
                </ThemedText>
              </View>
            </View>
          ))}
        </ThemedView>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
          <ThemedText type="default" style={{ color: '#e74c3c' }}>
            Sair da conta
          </ThemedText>
        </Pressable>
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
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
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
  avatarSection: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
  },
  name: {
    fontSize: 28,
    textAlign: 'center',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  infoCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  infoContent: {
    gap: Spacing.half,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
})
