import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCart } from '../contexts/CartContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ScannerScreen() {
  const router = useRouter();
  const { applyCoupon, isValidatingDiscount } = useCart();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text>Carregando permissões...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginBottom: 15 }}>Precisamos da sua permissão para mostrar a câmera</Text>
        <Button onPress={requestPermission} title="Conceder Permissão" />
      </View>
    );
  }

  const handleBarCodeScanned = (result: any) => {
    if (scanned || isValidatingDiscount) return;
    
    const data = result.data;
    if (!data) return;

    // Formato esperado: userCouponId|userId|email
    const parts = data.split('|');
    
    if (parts.length >= 2) {
      setScanned(true);
      const userCouponId = parts[0].trim();
      const userId = parts[1].trim();
      
      // GAMBIARRA TEMPORÁRIA: O scanner está lendo "+" como " " (espaço).
      // Forçamos a volta do "+" para não quebrar a validação no Medusa/Supabase.
      let email = parts[2] ? parts[2].trim() : '';
      if (email.includes(' ')) {
        email = email.replace(/ /g, '+');
      }

      // Aplica o cupom e volta imediatamente pra tela principal
      applyCoupon(userCouponId, userId, email);
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.layerTop}>
            <Text style={styles.scanText}>Escaneie o QR Code do Cliente</Text>
          </View>
          <View style={styles.layerCenter}>
            <View style={styles.layerLeft} />
            <View style={styles.focused} />
            <View style={styles.layerRight} />
          </View>
          <View style={styles.layerBottom}>
            <Text style={{ color: '#aaa', marginTop: 20 }}>Posicione o código no quadrado</Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const opacity = 'rgba(0, 0, 0, .6)';
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  layerTop: {
    flex: 2,
    backgroundColor: opacity,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20
  },
  scanText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  layerCenter: {
    flex: 3,
    flexDirection: 'row',
  },
  layerLeft: {
    flex: 1,
    backgroundColor: opacity,
  },
  focused: {
    flex: 10,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
  layerRight: {
    flex: 1,
    backgroundColor: opacity,
  },
  layerBottom: {
    flex: 2,
    backgroundColor: opacity,
    alignItems: 'center'
  },
});
