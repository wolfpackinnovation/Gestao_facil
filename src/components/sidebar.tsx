import { View, Pressable, StyleSheet, Dimensions, Alert } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.7;

const sidebarItems = [
  { icon: 'house', label: 'Início', route: '/' },
  { icon: 'scissors', label: 'Cortes', route: '/cortes' },
  { icon: 'chart.bar.fill', label: 'Relatórios', route: '/relatorios' },
  { icon: 'chart.line.downtrend.xyaxis', label: 'Controle de Perdas', route: '/controle-perdas' },
  { icon: 'gearshape', label: 'Configuração', route: '/configuracao' },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  const colors = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();

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

      <View
        style={[styles.drawer, { backgroundColor: colors.background }]}>
        <ThemedView style={styles.drawerHeader}>
          <ThemedText type="subtitle" style={styles.drawerTitle}>
            GestãoFácil
          </ThemedText>
          <Pressable onPress={onClose}>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'xmark', web: 'close' }}
              size={20}
            />
          </Pressable>
        </ThemedView>

        <Pressable
          style={styles.profileSection}
          onPress={() => {
            onClose();
            router.navigate('/perfil');
          }}>
          <ThemedView type="backgroundSelected" style={styles.avatar}>
            <ThemedText type="title">
              {user?.displayName
                ? user.displayName.charAt(0).toUpperCase()
                : user?.email?.charAt(0).toUpperCase() ?? '?'}
            </ThemedText>
          </ThemedView>
          <ThemedText type="smallBold">
            {user?.displayName ?? 'Usuário'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {user?.email ?? ''}
          </ThemedText>
        </Pressable>

        <ThemedView style={styles.navSection}>
          {sidebarItems.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                styles.navItem,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                onClose();
                router.navigate(item.route as any);
              }}>
              <SymbolView
                tintColor={colors.text}
                name={{ ios: item.icon as any, web: 'link' }}
                size={22}
              />
              <ThemedText type="default">{item.label}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedView style={styles.footerSection}>
          <Pressable
            style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.7 }]}
            onPress={handleLogout}>
            <SymbolView
              tintColor={colors.textSecondary}
              name={{ ios: 'arrow.right.square', web: 'logout' }}
              size={22}
            />
            <ThemedText type="default" themeColor="textSecondary">
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
    paddingTop: Spacing.six,
    zIndex: 101,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  drawerTitle: {
    fontSize: 24,
  },
  profileSection: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  navSection: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  footerSection: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: Spacing.two,
  },
});
