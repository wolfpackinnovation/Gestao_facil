import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type HeaderProps = {
  onMenuPress: () => void;
  title: string;
};

export default function Header({ onMenuPress, title }: HeaderProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ThemedView style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable onPress={onMenuPress} style={styles.menuButton}>
        <SymbolView
          tintColor={colors.text}
          name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
          size={24}
        />
      </Pressable>

      <ThemedText type="smallBold" style={styles.brandText}>
        {title}
      </ThemedText>

      <Pressable onPress={() => router.navigate('/notificacao')} style={styles.notificationButton}>
        <ThemedView style={styles.iconCircle}>
          <SymbolView
            tintColor={colors.primary}
            name={{ ios: 'bell', android: 'notifications', web: 'search' }}
            size={26}
          />
        </ThemedView>
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
    paddingVertical: Spacing.two,
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
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
