import { useState, useCallback, useRef } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { useAuth } from '@/contexts/auth';
import { createFiscalDocument } from '@/services/fiscal-document-service';

export default function EscanearQRFiscalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scannedRef = useRef(false);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanned(true);

    try {
      const cleaned = data.trim();
      const docNumber = cleaned.length >= 44 ? cleaned.slice(0, 44) : cleaned;

      await createFiscalDocument({
        companyId,
        type: 'Nota Fiscal',
        party: 'QR Code',
        value: 0,
        date: new Date().toISOString().split('T')[0],
        number: docNumber,
        status: 'Pendente',
        status2: '',
        entrada: false,
        notes: `Importado via QR Code em ${new Date().toLocaleString('pt-BR')}`,
      });

      Alert.alert('Documento criado', `Chave: ${docNumber}\n\nO documento foi adicionado com sucesso.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível criar o documento a partir do QR Code.');
      scannedRef.current = false;
      setScanned(false);
    }
  }, [companyId, router]);

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <Loading />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#6B7280" />
          <Text style={styles.permissionTitle}>Permissão de câmera necessária</Text>
          <Text style={styles.permissionText}>
            Para escanear QR Codes de notas fiscais, precisamos da sua permissão para usar a câmera.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Conceder permissão</Text>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <SafeAreaView style={styles.cameraOverlay} edges={['top']}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </SafeAreaView>

        <View style={styles.scanFrame}>
          <View style={styles.scanFrameBorder} />
          <Text style={styles.scanHint}>Posicione o QR Code da NF-e no centro</Text>
        </View>

        <View style={styles.cameraBottom}>
          {scanned && (
            <Pressable
              style={styles.rescanBtn}
              onPress={() => {
                scannedRef.current = false;
                setScanned(false);
              }}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.rescanBtnText}>Escanear novamente</Text>
            </Pressable>
          )}
        </View>
      </CameraView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)' },
  scanFrame: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrameBorder: { width: 250, height: 250, borderRadius: 16, borderWidth: 2, borderColor: '#C4956A', backgroundColor: 'transparent' },
  scanHint: { color: '#FFFFFF', fontSize: 14, marginTop: 24, textAlign: 'center', opacity: 0.8 },
  cameraBottom: { alignItems: 'center', paddingBottom: 60 },
  rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
  rescanBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  permissionText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  permissionBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: '#C4956A' },
  permissionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
