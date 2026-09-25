import { View, Pressable, StyleSheet, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useRouter, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { usePremium } from '@/contexts/premium';

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.75;

const mainItems = [
  { icon: 'home', label: 'Início', route: '/' },
  { icon: 'cash', label: 'Pagamentos', route: '/pagamentos' },
];

const premiumItems = [
  { icon: 'trending-up', label: 'Financeiro', route: '/financeiro' },
  { icon: 'bar-chart', label: 'Relatórios', route: '/relatorios' },
  { icon: 'document-text', label: 'Arquivos fiscais', route: '/arquivos-fiscais' },
];

const accountItems = [
  { icon: 'diamond', label: 'Assinatura', route: '/assinatura' },
  { icon: 'card', label: 'Banco', route: '/banco' },
  { icon: 'settings', label: 'Configurações', route: '/configuracao' },
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
  const { isPremium } = usePremium();

  const tabRoutes = ['/', '/estoque', '/vendas', '/financeiro', '/receitas', '/clientes'];

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/' || pathname === '';
    return pathname === route || pathname.startsWith(route + '/');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja sair?')) {
        onClose();
        logout();
      }
    } else {
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
    }
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
            const iconColor = active ? '#ffffff' : colors.textSecondary;
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
                <Ionicons name={item.icon as any} size={22} color={iconColor} />
                <ThemedText
                  type="default"
                  style={[styles.navLabel, active && { color: '#ffffff' }]}>
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}

          <View style={styles.separator} />

          <ThemedText style={styles.sectionLabel}>PREMIUM</ThemedText>

          {premiumItems.map((item) => {
            const active = isActive(item.route);
            const iconColor = active ? '#ffffff' : !isPremium ? '#C4956A' : colors.textSecondary;
            return (
              <Pressable
                key={item.route}
                style={({ pressed }) => [
                  styles.navItem,
                  active && { backgroundColor: colors.primary },
                  !isPremium && !active && styles.premiumNavItem,
                  pressed && !active && { opacity: 0.7 },
                ]}
                onPress={() => {
                  onClose();
                  router.navigate(item.route as any);
                }}>
                <Ionicons name={item.icon as any} size={22} color={iconColor} />
                <ThemedText
                  type="default"
                  style={[
                    styles.navLabel,
                    active && { color: '#ffffff' },
                    !isPremium && !active && styles.premiumLabel,
                  ]}>
                  {item.label}
                </ThemedText>
                {!isPremium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="diamond" size={16} color="#C4956A" />
                  </View>
                )}
              </Pressable>
            );
          })}

          <View style={styles.separator} />

          <ThemedText style={styles.sectionLabel}>CONTA</ThemedText>

          {accountItems.map((item) => {
            const active = isActive(item.route);
            const iconColor = active ? '#ffffff' : colors.textSecondary;
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
                <Ionicons name={item.icon as any} size={22} color={iconColor} />
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
            <Ionicons name="exit" size={22} color="#DC2626" />
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
  navLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  premiumNavItem: {
    backgroundColor: 'rgba(196, 149, 106, 0.1)',
  },
  premiumLabel: {
    color: '#C4956A',
  },
  premiumBadge: {
    marginLeft: 'auto',
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
