import { useState } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native'
import { Link, useRouter } from 'expo-router'

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
  const { signIn } = useAuth()
  const colors = useTheme()
  const router = useRouter()

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
        behavior="padding"
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
              { backgroundColor: '#C4956A' },
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
        </View>

        <View style={styles.footer}>
          <ThemedText type="default" themeColor="textSecondary">
            Não tem uma conta?{' '}
          </ThemedText>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <ThemedText type="default" style={{ color: '#C4956A' }}>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
