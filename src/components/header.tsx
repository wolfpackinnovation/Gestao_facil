import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

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

      <View style={styles.menuButton} />
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
});
