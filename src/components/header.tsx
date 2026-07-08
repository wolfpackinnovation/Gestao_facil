import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type HeaderProps = {
  onMenuPress: () => void;
};

export default function Header({ onMenuPress }: HeaderProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ThemedView style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable onPress={onMenuPress} style={styles.menuButton}>
        <SymbolView
          tintColor={colors.text}
          name={{ ios: 'line.3.horizontal', web: 'menu' }}
          size={24}
        />
      </Pressable>

      <ThemedText type="smallBold" style={styles.brandText}>
        GestãoFácil
      </ThemedText>

      <Pressable onPress={() => router.navigate('/notificacao')} style={styles.notificationButton}>
        <SymbolView
          tintColor={colors.text}
          name={{ ios: 'bell', web: 'search' }}
          size={22}
        />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  menuButton: {
    padding: Spacing.one,
  },
  brandText: {
    fontSize: 18,
  },
  notificationButton: {
    padding: Spacing.one,
  },
});
