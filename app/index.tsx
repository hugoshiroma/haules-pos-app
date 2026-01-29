import React, { useEffect, useRef, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Alert, 
  ScrollView, 
  Modal, 
  TextInput, 
  Animated, 
  PanResponder, 
  Dimensions,
  Pressable,
  RefreshControl
} from 'react-native';
import { useProducts, Product } from '../hooks/useProducts';
import { useCart } from '../contexts/CartContext';
import { useRouter, Stack } from 'expo-router';
import { getLogContent, clearLog } from '../lib/logging';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const MINI_FOOTER_HEIGHT = 80;

// Componente para renderizar cada item da lista de produtos
const ProductCard = ({ item, onAddToCart }: { item: Product, onAddToCart: (item: any) => void }) => {
  const variant = item.variants[0];
  const price = variant?.prices[0];

  if (!variant || !price) return null;
  
  return (
    <View style={styles.card}>
      <View style={styles.thumbnailContainer}>
        <Image style={styles.thumbnail} source={{ uri: item.thumbnail || 'https://via.placeholder.com/100' }} />
        <Text style={styles.productTitleOverlay} numberOfLines={2}>{item.title}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.productPrice}>R$ {(price.amount / 100).toFixed(2)}</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={() => onAddToCart({ id: variant.id, product_id: item.id, title: item.title, price: price.amount / 100 })}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function PosScreen() {
  const insets = useSafeAreaInsets();
  const { products, isLoading, isRefreshing, error, refresh } = useProducts();
  const { 
    items, addItem, removeItem, total, confirmOrder, isLoading: isCartLoading, 
    token, activateTerminal, login, statusConfig, hideStatus, showStatus,
    biometricLogin, hasSavedCredentials 
  } = useCart();
  const router = useRouter();
  
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Controle de Animação do BottomSheet
  const panY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [isOpen, setIsOpen] = useState(false);

  // Posições dinâmicas baseadas no Safe Area
  const CLOSED_POSITION = SHEET_HEIGHT - (MINI_FOOTER_HEIGHT + insets.bottom);
  const OPEN_POSITION = 0;

  // Tentativa automática de biometria ao abrir se tiver credenciais salvas e não estiver logado
  useEffect(() => {
    if (hasSavedCredentials && !token) {
      handleBiometricAuth();
    }
  }, [hasSavedCredentials, token]);

  const handleBiometricAuth = async () => {
    const success = await biometricLogin();
    if (success) {
      showStatus('success', 'Login Biométrico', 'Bem-vindo de volta!');
    }
  };

  // Resetar o BottomSheet quando o carrinho mudar
  useEffect(() => {
    if (items.length === 0) {
      panY.setValue(CLOSED_POSITION);
      setIsOpen(false);
    } else if (items.length === 1 && items[0].quantity === 1 && !isOpen) {
      panY.setValue(CLOSED_POSITION);
    }
  }, [items.length, insets.bottom]);

  const toggleSheet = (open: boolean) => {
    Animated.spring(panY, {
      toValue: open ? OPEN_POSITION : CLOSED_POSITION,
      useNativeDriver: true,
      friction: 8,
      tension: 40
    }).start();
    setIsOpen(open);
  };

  const onRefresh = async () => {
    toggleSheet(false);
    await refresh();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const newY = (isOpen ? OPEN_POSITION : CLOSED_POSITION) + gestureState.dy;
        if (newY >= OPEN_POSITION) {
          panY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50 || (isOpen && gestureState.dy < 50)) {
          toggleSheet(true);
        } else {
          toggleSheet(false);
        }
      },
    })
  ).current;

  const handleLoginSubmit = async () => {
    if (!email || !password) return showStatus('warning', 'Dados Incompletos', 'Preencha email e senha.');
    setIsLoggingIn(true);
    try {
      const response = await login(email, password, true);
      if (response) {
        setShowLoginModal(false);
        setEmail('');
        setPassword('');
        showStatus('success', 'Login Realizado!', 'Sua biometria será usada nas próximas vezes.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConfirm = () => {
    if (!token) return setShowLoginModal(true);
    confirmOrder();
  };

  const backdropOpacity = panY.interpolate({
    inputRange: [OPEN_POSITION, CLOSED_POSITION],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const getStatusIcon = (type: string) => {
    switch(type) {
      case 'success': return <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />;
      case 'error': return <Ionicons name="close-circle" size={80} color="#f44336" />;
      case 'warning': return <Ionicons name="warning" size={80} color="#ff9800" />;
      default: return <Ionicons name="information-circle" size={80} color="#2196F3" />;
    }
  };

  if (showLogs) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }]}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Logs do Sistema</Text>
        <ScrollView style={{ flex: 1, backgroundColor: '#000', borderRadius: 12, padding: 12 }}>
          <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 12 }}>{logContent}</Text>
        </ScrollView>
        <TouchableOpacity 
          style={[styles.confirmButtonLarge, { marginTop: 16, backgroundColor: '#666' }]} 
          onPress={() => setShowLogs(false)}
        >
          <Text style={styles.confirmButtonText}>Fechar Janela</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: totalItems > 0 ? MINI_FOOTER_HEIGHT + insets.bottom : insets.bottom }]}>
      <Stack.Screen 
        options={{ 
          title: 'Haules PoS',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => router.push('/scanner')} style={{ marginRight: 15 }}><Ionicons name="scan" size={22} color="#2196F3" /></TouchableOpacity>
              <TouchableOpacity onPress={activateTerminal} style={{ marginRight: 15 }}><Ionicons name="card" size={22} color="#2196F3" /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowLoginModal(true)} style={{ marginRight: 15 }}>
                <Ionicons name="person" size={22} color={token ? '#4CAF50' : '#2196F3'} />
              </TouchableOpacity>
              {hasSavedCredentials && !token && (
                <TouchableOpacity onPress={handleBiometricAuth} style={{ marginRight: 15 }}>
                  <Ionicons name="finger-print" size={22} color="#2196F3" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={async () => { setLogContent(await getLogContent()); setShowLogs(true); }}><Ionicons name="list" size={22} color="#2196F3" /></TouchableOpacity>
            </View>
          )
        }} 
      />
      
      <FlatList
        data={products}
        renderItem={({ item }) => <ProductCard item={item} onAddToCart={addItem} />}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#2196F3']} tintColor="#2196F3" />
        }
      />

      {/* Backdrop */}
      {totalItems > 0 && (
        <Animated.View 
          pointerEvents={isOpen ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
        >
          <Pressable style={{ flex: 1 }} onPress={() => toggleSheet(false)} />
        </Animated.View>
      )}

      {/* Bottom Sheet Persistente */}
      {totalItems > 0 && (
        <Animated.View 
          style={[styles.bottomSheet, { height: SHEET_HEIGHT, transform: [{ translateY: panY }] }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => toggleSheet(!isOpen)} style={[styles.sheetHandleArea, { paddingBottom: isOpen ? 12 : 12 + insets.bottom }]}>
            <View style={styles.handleBar} />
            <View style={styles.miniFooter}>
              <Text style={styles.miniFooterText}>{totalItems} itens • R$ {total.toFixed(2)}</Text>
              <Text style={styles.expandText}>{isOpen ? 'Arraste para fechar' : 'Puxe para detalhes'}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.sheetTitle}>Itens no Carrinho</Text>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemTitle}>{item.title}</Text>
                    <Text style={styles.cartItemSub}>R$ {item.price.toFixed(2)} x {item.quantity}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.cartItemTotal}>R$ {(item.price * item.quantity).toFixed(2)}</Text>
                    <View style={styles.quantityActions}>
                      <TouchableOpacity 
                        style={styles.removeButton} 
                        onPress={() => { 
                          removeItem(item.id); 
                          if (items.length <= 1 && item.quantity === 1) toggleSheet(false); 
                        }}
                      >
                        <Text style={styles.removeButtonText}>-</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.inlineAddButton} 
                        onPress={() => addItem({ id: item.id, product_id: item.product_id, title: item.title, price: item.price })}
                      >
                        <Text style={styles.inlineAddButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              style={{ maxHeight: SHEET_HEIGHT * 0.45 }}
            />
            
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.confirmButtonLarge} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Finalizar Compra • R$ {total.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Modal de Login */}
      <Modal visible={showLoginModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Login de Funcionário</Text>
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Senha" value={password} onChangeText={setPassword} secureTextEntry />
            <TouchableOpacity style={styles.confirmButtonLarge} onPress={handleLoginSubmit} disabled={isLoggingIn}>
              {isLoggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Entrar</Text>}
            </TouchableOpacity>
            {hasSavedCredentials && (
              <TouchableOpacity style={[styles.confirmButtonLarge, {backgroundColor: '#2196F3', marginTop: 10}]} onPress={handleBiometricAuth}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Ionicons name="finger-print" size={20} color="white" style={{marginRight: 10}} />
                  <Text style={styles.confirmButtonText}>Usar Biometria</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowLoginModal(false)} style={{ marginTop: 15 }}><Text style={{ color: '#666', textAlign: 'center' }}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Overlay de Loading/Status Global */}
      {(isCartLoading || statusConfig.visible) && (
        <View style={styles.globalLoadingOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={statusConfig.visible ? hideStatus : undefined} />
          <View style={styles.statusBox}>
            {isCartLoading ? (
              <>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.statusText}>Processando Pagamento...</Text>
                <Text style={styles.statusSubText}>Aguarde a resposta da maquininha</Text>
              </>
            ) : (
              <>
                {getStatusIcon(statusConfig.type)}
                <Text style={styles.statusText}>{statusConfig.title}</Text>
                <Text style={styles.statusSubText}>{statusConfig.message}</Text>
                {(statusConfig.type === 'error' || statusConfig.type === 'warning') && (
                  <TouchableOpacity style={[styles.confirmButtonLarge, {width: '100%', marginTop: 20}]} onPress={hideStatus}>
                    <Text style={styles.confirmButtonText}>Ok</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerButtonText: { fontSize: 13, color: '#2196F3', fontWeight: 'bold' },
  list: { padding: 8 },
  card: { flex: 1, margin: 8, backgroundColor: '#fff', borderRadius: 12, elevation: 3, overflow: 'hidden' },
  thumbnailContainer: { width: '100%', height: 100, backgroundColor: '#e0e0e0', position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  productTitleOverlay: { 
    position: 'absolute', 
    bottom: 8, 
    left: 8, 
    right: 8, 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: 'black',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 4,
    borderRadius: 4
  },
  cardInfo: { padding: 10 },
  productPrice: { fontSize: 16, color: '#4CAF50', fontWeight: 'bold' },
  addButton: { position: 'absolute', right: 8, bottom: 8, backgroundColor: '#2196F3', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  
  bottomSheet: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    elevation: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -3 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 5 
  },
  sheetHandleArea: { alignItems: 'center', paddingTop: 12 },
  handleBar: { width: 40, height: 5, backgroundColor: '#e0e0e0', borderRadius: 3, marginBottom: 8 },
  miniFooter: { alignItems: 'center' },
  miniFooterText: { fontSize: 16, fontWeight: 'bold' },
  expandText: { fontSize: 11, color: '#aaa', marginTop: 2 },
  
  sheetContent: { paddingHorizontal: 20, paddingTop: 10 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  cartItemTitle: { fontSize: 15, fontWeight: 'bold' },
  cartItemSub: { fontSize: 13, color: '#666' },
  cartItemTotal: { fontSize: 15, fontWeight: 'bold', marginRight: 12 },
  quantityActions: { flexDirection: 'row', alignItems: 'center' },
  removeButton: { backgroundColor: '#ff5252', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: -2 },
  inlineAddButton: { backgroundColor: '#4CAF50', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  inlineAddButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: -1 },
  sheetFooter: { marginTop: 20 },
  
  confirmButtonLarge: { backgroundColor: '#4CAF50', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 25 },
  loginCard: { backgroundColor: '#fff', borderRadius: 20, padding: 25 },
  loginTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 15 },
  
  globalLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  statusBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    width: '85%',
    elevation: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#333',
  },
  statusSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});
