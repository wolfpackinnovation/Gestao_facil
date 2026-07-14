import { useState } from 'react';
import { DefaultTheme, ThemeProvider, Slot, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View, StyleSheet } from 'react-native';

import { AuthProvider } from '@/contexts/auth';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';

SplashScreen.preventAutoHideAsync();

const hideHeaderRoutes = new Set(['/login', '/signup', '/notificacao', '/perfil', '/produto-detalhe', '/cliente-detalhe', '/nova-venda', '/financeiro-detalhe', '/adicionar-documento-fiscal', '/escanear-qr-fiscal'])

const routeTitles: Record<string, string> = {
  'index': 'GestFacil',
  'estoque': 'Estoque',
  'vendas': 'Vendas',
  'caixa': 'Caixa',
  'financeiro': 'Financeiro',
  'clientes': 'Clientes',
  'configuracao': 'Configuração',
  'cortes': 'Cortes',
  'relatorios': 'Relatórios',
  'arquivos-fiscais': 'Arquivos Fiscais',
  'pagamentos': 'Pagamentos',
  'nova-venda': 'Nova Venda',
  'mais': 'Mais',
  'explore': 'Explorar',
}

function getRouteTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1] || 'index'
  return routeTitles[last] ?? 'GestFacil'
}

function RootLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <ThemeProvider value={DefaultTheme}>
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
    <AuthProvider>
      <RootLayoutInner />
    </AuthProvider>
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
