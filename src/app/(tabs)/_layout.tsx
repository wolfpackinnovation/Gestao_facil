import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, type ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';

function HomeTabIcon({ color, size, focused }: { color: ColorValue; size: number; focused?: boolean }) {
  const theme = useTheme();
  const circleSize = size + 28;
  return (
    <View style={[styles.circle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: focused ? theme.primary : theme.backgroundElement }]}>
      <Ionicons name="home-outline" size={size} color={focused ? '#ffffff' : color} />
    </View>
  );
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; label: string; icon: IoniconsName }[] = [
  { name: 'estoque', label: 'Estoque', icon: 'cube-outline' },
  { name: 'vendas', label: 'Vendas', icon: 'card-outline' },
  { name: 'index', label: 'Início', icon: 'home-outline' },
  { name: 'receitas', label: 'Receitas', icon: 'trending-up-outline' },
  { name: 'clientes', label: 'Clientes', icon: 'people-outline' },
];

export default function TabLayout() {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!user && !loading) {
      router.replace('/(auth)/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background },
        headerShown: false,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarLabel: tab.name === 'index' ? '' : tab.label,
            tabBarIcon: ({ color, size, focused }) =>
              tab.name === 'index' ? (
                <HomeTabIcon color={color} size={size} focused={focused} />
              ) : (
                <Ionicons name={tab.icon} size={size} color={color} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
