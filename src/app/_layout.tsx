import { useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Slot, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View, StyleSheet } from 'react-native';

import { ThemeModeProvider, useThemeMode } from '@/contexts/theme-mode';
import { AuthProvider } from '@/contexts/auth';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';

SplashScreen.preventAutoHideAsync();

const hideHeaderRoutes = new Set(['/login', '/signup', '/notificacao', '/perfil', '/produto-detalhe', '/cliente-detalhe', '/nova-venda'])

const routeTitles: Record<string, string> = {
  'index': 'Início',
  'estoque': 'Estoque',
  'vendas': 'Vendas',
  'caixa': 'Caixa',
  'clientes': 'Clientes',
  'configuracao': 'Configuração',
  'cortes': 'Cortes',
  'relatorios': 'Relatórios',
  'controle-perdas': 'Controle de Perdas',
  'nova-venda': 'Nova Venda',
  'mais': 'Mais',
  'explore': 'Explorar',
}

function getRouteTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1] || 'index'
  return routeTitles[last] ?? 'GestãoFácil'
}

function RootLayoutInner() {
  const { resolvedTheme } = useThemeMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <ThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <View style={styles.root}>
        {!hideHeaderRoutes.has(pathname) && <Header onMenuPress={() => setSidebarOpen(true)} title={getRouteTitle(pathname)} />}
        <View style={styles.content}>
          <Slot />
        </View>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </ThemeModeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
