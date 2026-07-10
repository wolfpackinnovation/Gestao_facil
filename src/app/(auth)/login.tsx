import { useState, useEffect } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import * as Google from 'expo-auth-session/providers/google'
import { Ionicons } from '@expo/vector-icons'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/hooks/use-theme'
import { Spacing } from '@/constants/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signIn, signInWithGoogle } = useAuth()
  const colors = useTheme()
  const router = useRouter()

  const [, googleResponse, googlePrompt] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  })

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params
      setSubmitting(true)
      setError('')
      signInWithGoogle(id_token)
        .then(() => router.replace('/'))
        .catch((e: any) => setError(e.message || 'Erro ao entrar com Google.'))
        .finally(() => setSubmitting(false))
    }
  }, [googleResponse])

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      router.replace('/')
    } catch (e: any) {
      setError(e.message || 'Erro ao fazer login.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            GestFacil
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Faça login para continuar
          </ThemedText>
        </View>

        <View style={styles.form}>
          {error ? (
            <ThemedView type="backgroundSelected" style={styles.errorBox}>
              <ThemedText type="small" style={{ color: '#e74c3c' }}>
                {error}
              </ThemedText>
            </ThemedView>
          ) : null}

          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.backgroundElement },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!submitting}
          />

          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.backgroundElement },
            ]}
            placeholder="Senha"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={!submitting}
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: '#3c87f7' },
              pressed && styles.buttonPressed,
              submitting && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText type="default" style={styles.buttonText}>
                Entrar
              </ThemedText>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.textSecondary }]} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.dividerText}>
              ou
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: colors.textSecondary }]} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              { borderColor: colors.textSecondary },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => googlePrompt()}
            disabled={submitting}
          >
            <Ionicons name="logo-google" size={20} color={colors.text} />
            <ThemedText type="default" style={styles.googleButtonText}>
              Entrar com Google
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <ThemedText type="default" themeColor="textSecondary">
            Não tem uma conta?{' '}
          </ThemedText>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <ThemedText type="default" style={{ color: '#3c87f7' }}>
                Cadastre-se
              </ThemedText>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 36,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.three,
  },
  errorBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  input: {
    height: 50,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    textTransform: 'uppercase',
  },
  googleButton: {
    height: 50,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  googleButtonText: {
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
