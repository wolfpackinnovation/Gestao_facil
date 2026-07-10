import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; label: string; icon: IoniconsName }[] = [
  { name: 'estoque', label: 'Estoque', icon: 'cube-outline' },
  { name: 'vendas', label: 'Vendas', icon: 'card-outline' },
  { name: 'index', label: 'Início', icon: 'home-outline' },
  { name: 'financeiro', label: 'Financeiro', icon: 'trending-up-outline' },
  { name: 'clientes', label: 'Clientes', icon: 'people-outline' },
];

export default function TabLayout() {
  const { user, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: theme.text,
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
            tabBarIcon: ({ color, size }) => (
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
});
