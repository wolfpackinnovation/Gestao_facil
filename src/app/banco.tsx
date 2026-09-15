import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import {
  getCompanyInfo,
  saveCompanyInfo,
  type CompanyInfo,
} from '@/services/settings-service';

type PixKeyType = CompanyInfo['pixKeyType'];

const PIX_TYPES: { value: PixKeyType; label: string; placeholder: string; keyboardType?: 'default' | 'email-address' | 'numeric' }[] = [
  { value: 'cpf', label: 'CPF', placeholder: '000.000.000-00', keyboardType: 'numeric' },
  { value: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00', keyboardType: 'numeric' },
  { value: 'email', label: 'E-mail', placeholder: 'seu@email.com', keyboardType: 'email-address' },
  { value: 'telefone', label: 'Telefone', placeholder: '(00) 00000-0000', keyboardType: 'numeric' },
  { value: 'aleatoria', label: 'Chave aleatória', placeholder: 'Cole sua chave aleatória' },
];

function maskPixKey(value: string, type: PixKeyType): string {
  const digits = value.replace(/\D/g, '');
  if (type === 'cpf') {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  if (type === 'cnpj') {
    return digits
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
  if (type === 'telefone') {
    return digits.replace(/^55/, '').slice(0, 11);
  }
  return value;
}

function normalizePixKeyValue(value: string, type: PixKeyType): string {
  if (type === 'telefone') return normalizePhoneKey(value);
  if (type === 'cpf' || type === 'cnpj') return value.replace(/\D/g, '');
  return value.trim();
}

function normalizePhoneKey(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const national = digits.replace(/^55/, '');
  if (national.length < 10) return `+55${national}`;
  if (national.length === 10) return `+55${national.slice(0, 2)}9${national.slice(2)}`;
  return `+55${national.slice(0, 11)}`;
}

export default function BancoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('cpf');
  const [pixCity, setPixCity] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    const info = await getCompanyInfo(companyId);
    setDisplayName(info.name ?? user?.displayName ?? '');
    setPixKey(info.pixKey ?? '');
    setPixKeyType((info.pixKeyType as PixKeyType) ?? 'cpf');
    setPixCity((info as any).pixCity ?? '');
    setLoading(false);
  }, [companyId, user?.displayName]);

  useEffect(() => {
    load();
  }, [load]);

  function handleChangeKey(value: string) {
    if (pixKeyType === 'cpf' || pixKeyType === 'cnpj' || pixKeyType === 'telefone') {
      setPixKey(maskPixKey(value, pixKeyType));
    } else {
      setPixKey(value);
    }
  }

  function handleChangeType(type: PixKeyType) {
    setPixKeyType(type);
    setPixKey('');
  }

  async function handleSave() {
    if (!companyId) return;
    if (!displayName.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do recebedor.');
      return;
    }
    if (pixKey.trim() && pixKeyType !== 'aleatoria' && pixKey.replace(/\D/g, '').length === 0) {
      Alert.alert('Chave inválida', 'Verifique a chave PIX informada.');
      return;
    }
    if (pixKey.trim() && !pixCity.trim()) {
      Alert.alert('Cidade obrigatória', 'Informe a cidade do recebedor para gerar QR válido.');
      return;
    }
    setSaving(true);
    try {
      const current = await getCompanyInfo(companyId);
      const finalKey = normalizePixKeyValue(pixKey, pixKeyType);
      await saveCompanyInfo(companyId, {
        ...current,
        name: displayName.trim(),
        pixKey: finalKey,
        pixKeyType,
        pixCity: pixCity.trim(),
      });
      if (finalKey !== pixKey.trim()) {
        setPixKey(finalKey);
      }
      Alert.alert('Salvo', 'Dados bancários atualizados com sucesso.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Loading />
      </ThemedView>
    );
  }

  const selectedType = PIX_TYPES.find((t) => t.value === pixKeyType)!;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <ThemedView style={styles.heroCard}>
              <Ionicons name="card" size={32} color={theme.primary} />
              <ThemedText type="subtitle" style={styles.heroTitle}>Chave PIX</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heroSub}>
                Cadastre a chave PIX que será usada para receber pagamentos.
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Nome do recebedor</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="Seu nome completo"
                placeholderTextColor={theme.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                maxLength={40}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Será exibido (após normalização) no QR Code como identificação do recebedor.
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Tipo da chave</ThemedText>
              <ThemedView style={styles.chipsRow}>
                {PIX_TYPES.map((t) => (
                  <Pressable
                    key={t.value}
                    onPress={() => handleChangeType(t.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          pixKeyType === t.value ? theme.primary : theme.backgroundElement,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color: pixKeyType === t.value ? '#ffffff' : theme.text,
                        fontWeight: '600',
                      }}
                    >
                      {t.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Chave PIX</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder={selectedType.placeholder}
                placeholderTextColor={theme.textSecondary}
                value={pixKey}
                onChangeText={handleChangeKey}
                keyboardType={selectedType.keyboardType ?? 'default'}
                autoCapitalize={pixKeyType === 'email' ? 'none' : 'sentences'}
                autoCorrect={false}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {pixKeyType === 'cpf' && 'Informe o CPF (somente números ou com pontuação).'}
                {pixKeyType === 'cnpj' && 'Informe o CNPJ (somente números ou com pontuação).'}
                {pixKeyType === 'email' && 'Informe o e-mail vinculado à conta PIX.'}
                {pixKeyType === 'telefone' && 'Informe o celular com DDD.'}
                {pixKeyType === 'aleatoria' && 'Cole a chave aleatória gerada pelo seu banco.'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Cidade do recebedor</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="Ex: São Paulo"
                placeholderTextColor={theme.textSecondary}
                value={pixCity}
                onChangeText={setPixCity}
                autoCapitalize="words"
                maxLength={25}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Necessário para gerar o QR Code válido. Até 15 caracteres após normalização.
              </ThemedText>
            </ThemedView>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
            >
              <ThemedText style={styles.saveButtonText}>
                {saving ? 'Salvando...' : 'Salvar'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scroll: {
    padding: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  heroCard: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.one,
  },
  heroTitle: { marginTop: Spacing.one },
  heroSub: { textAlign: 'center', maxWidth: 280 },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.half,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hint: { lineHeight: 18 },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
