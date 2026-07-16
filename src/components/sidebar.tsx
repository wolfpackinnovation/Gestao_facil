import { View, Pressable, StyleSheet, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useRouter, usePathname } from 'expo-router';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.75;

const mainItems = [
  { emoji: '🏠', label: 'Início', route: '/' },
  { emoji: '🥩', label: 'Cortes', route: '/cortes' },
  { emoji: '📊', label: 'Relatórios', route: '/relatorios' },
  { emoji: '💰', label: 'Pagamentos', route: '/pagamentos' },
  { emoji: '📄', label: 'Arquivos fiscais', route: '/arquivos-fiscais' },
];

const accountItems = [
  { emoji: '👑', label: 'Assinatura', route: '/assinatura' },
  { emoji: '⚙️', label: 'Configurações', route: '/configuracao' },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  const colors = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const tabRoutes = ['/', '/estoque', '/vendas', '/financeiro', '/clientes'];

  const isActive = (route: string) => {
    if (route === '/') return tabRoutes.includes(pathname);
    return pathname.startsWith(route);
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await logout();
        },
      },
    ]);
  };

  if (!open) return null;

  return (
    <>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </View>

      <View style={[styles.drawer, { backgroundColor: colors.background }]}>
        <ThemedView style={styles.drawerHeader}>
          <View style={styles.drawerTitleRow}>
            <Image source={require('@/assets/icon.png')} style={styles.drawerIcon} />
            <ThemedText type="subtitle" style={styles.drawerTitle}>
              GestFacil
            </ThemedText>
          </View>
          <Pressable onPress={onClose}>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={20}
            />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.navSection}>
          <ThemedText style={styles.sectionLabel}>GERAL</ThemedText>

          {mainItems.map((item) => {
            const active = isActive(item.route);
            return (
              <Pressable
                key={item.route}
                style={({ pressed }) => [
                  styles.navItem,
                  active && { backgroundColor: colors.primary },
                  pressed && !active && { opacity: 0.7 },
                ]}
                onPress={() => {
                  onClose();
                  router.navigate(item.route as any);
                }}>
                <ThemedText style={[styles.navEmoji, active && { color: '#ffffff' }]}>
                  {item.emoji}
                </ThemedText>
                <ThemedText
                  type="default"
                  style={[styles.navLabel, active && { color: '#ffffff' }]}>
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}

          <View style={styles.separator} />

          <ThemedText style={styles.sectionLabel}>CONTA</ThemedText>

          {accountItems.map((item) => {
            const active = isActive(item.route);
            return (
              <Pressable
                key={item.route}
                style={({ pressed }) => [
                  styles.navItem,
                  active && { backgroundColor: colors.primary },
                  pressed && !active && { opacity: 0.7 },
                ]}
                onPress={() => {
                  onClose();
                  router.navigate(item.route as any);
                }}>
                <ThemedText style={[styles.navEmoji, active && { color: '#ffffff' }]}>
                  {item.emoji}
                </ThemedText>
                <ThemedText
                  type="default"
                  style={[styles.navLabel, active && { color: '#ffffff' }]}>
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}

          <View style={styles.separator} />
        </ThemedView>

        <ThemedView style={styles.footerSection}>
          <Pressable
            style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.7 }]}
            onPress={handleLogout}>
            <ThemedText style={styles.navEmoji}>🚪</ThemedText>
            <ThemedText type="default" style={[styles.navLabel, { color: '#DC2626' }]}>
              Sair
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    paddingTop: 54,
    zIndex: 101,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  drawerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  drawerTitle: {
    fontSize: 22,
  },
  navSection: {
    gap: 2,
    paddingHorizontal: 12,
    flex: 1,
    paddingTop: Spacing.one,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginVertical: 8,
    marginHorizontal: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#9CA3AF',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  footerSection: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    paddingTop: 4,
  },
});
