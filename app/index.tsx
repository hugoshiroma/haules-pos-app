import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
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
import { getLogContent } from '../lib/logging';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const MINI_FOOTER_HEIGHT = 80;

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
    token, activateTerminal, statusConfig, hideStatus, showStatus,
    clearCart, logout, isValidatingDiscount, discount, finalAmount,
    biometricLogin, hasSavedCredentials 
  } = useCart();
  const router = useRouter();
  
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const displayTotal = discount > 0 ? finalAmount : total;

  // Posições dinâmicas
  const HIDDEN_POSITION = SHEET_HEIGHT; 
  const CLOSED_POSITION = SHEET_HEIGHT - (MINI_FOOTER_HEIGHT + insets.bottom);
  const OPEN_POSITION = 0;

  const panY = useRef(new Animated.Value(HIDDEN_POSITION)).current;
  const [isOpen, setIsOpen] = useState(false);

  // Refs para evitar stale closure no PanResponder
  const isOpenRef = useRef(isOpen);
  const totalItemsRef = useRef(totalItems);
  const closedPosRef = useRef(CLOSED_POSITION);

  useEffect(() => {
    isOpenRef.current = isOpen;
    totalItemsRef.current = totalItems;
    closedPosRef.current = CLOSED_POSITION;
  }, [isOpen, totalItems, insets.bottom]);

  const toggleSheet = useCallback((open: boolean) => {
    const toValue = open ? OPEN_POSITION : (totalItemsRef.current > 0 ? CLOSED_POSITION : HIDDEN_POSITION);
    Animated.spring(panY, {
      toValue,
      useNativeDriver: true,
      friction: 8,
      tension: 40
    }).start();
    setIsOpen(open);
  }, [insets.bottom]);

  // Sincroniza a posição do sheet com a presença de itens (com travas de segurança)
  useEffect(() => {
    if (totalItems === 0 && panY._value !== HIDDEN_POSITION) {
      toggleSheet(false);
    } else if (totalItems > 0 && !isOpen && panY._value === HIDDEN_POSITION) {
      // Se acabou de adicionar o primeiro item, sobe pro CLOSED_POSITION
      Animated.spring(panY, {
        toValue: CLOSED_POSITION,
        useNativeDriver: true,
        friction: 8
      }).start();
    }
  }, [totalItems, insets.bottom, isOpen]);

  const onRefresh = async () => {
    if (isOpen) toggleSheet(false);
    await refresh();
  };

  const handleBiometricAuth = async () => {
    const success = await biometricLogin();
    if (success) {
      showStatus('success', 'Login Biométrico', 'Bem-vindo de volta!');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const base = isOpenRef.current ? OPEN_POSITION : closedPosRef.current;
        let newY = base + gestureState.dy;
        if (newY < OPEN_POSITION) newY = OPEN_POSITION;
        if (totalItemsRef.current > 0 && newY > closedPosRef.current) newY = closedPosRef.current;
        panY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          toggleSheet(true);
        } else if (gestureState.dy > 50) {
          toggleSheet(false);
        } else {
          toggleSheet(isOpenRef.current);
        }
      },
    })
  ).current;

  const handleClearCart = () => {
    clearCart();
    setShowClearConfirm(false);
    // Removido o showStatus de sucesso aqui conforme solicitado
  };

  const handleLogout = async (forgetMe: boolean) => {
    await logout(forgetMe);
    setShowLogoutConfirm(false);
  };

  const getStatusIcon = (type: string) => {
    switch(type) {
      case 'success': return <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />;
      case 'error': return <Ionicons name="close-circle" size={80} color="#f44336" />;
      case 'warning': return <Ionicons name="warning" size={80} color="#ff9800" />;
      default: return <Ionicons name="information-circle" size={80} color="#2196F3" />;
    }
  };

  const backdropOpacity = panY.interpolate({
    inputRange: [OPEN_POSITION, CLOSED_POSITION],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  // Se não estiver logado, não renderiza nada (o _layout mandará pro login)
  // Isso evita o erro de "Cannot update a component while rendering a different component"
  if (!token) return null;

  if (showLogs) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }]}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Logs do Sistema</Text>
        <ScrollView style={{ flex: 1, backgroundColor: '#000', borderRadius: 12, padding: 12 }}>
          <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 12 }}>{logContent}</Text>
        </ScrollView>
        <TouchableOpacity style={[styles.confirmButtonLarge, { marginTop: 16, backgroundColor: '#666' }]} onPress={() => setShowLogs(false)}>
          <Text style={styles.confirmButtonText}>Fechar Janela</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Haules PoS',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 5 }}>
              <TouchableOpacity 
                onPress={() => totalItems > 0 && router.push('/scanner')} 
                style={{ marginHorizontal: 10 }}
                disabled={totalItems === 0}
              >
                <Ionicons name="scan" size={26} color={totalItems > 0 ? "#2196F3" : "#ccc"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={activateTerminal} style={{ marginHorizontal: 10 }}><Ionicons name="card" size={26} color="#2196F3" /></TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setShowLogoutConfirm(true)} 
                style={{ marginHorizontal: 10 }}
              >
                <Ionicons name="log-out-outline" size={26} color="#f44336" />
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { setLogContent(await getLogContent()); setShowLogs(true); }} style={{ marginLeft: 10 }}><Ionicons name="list" size={26} color="#2196F3" /></TouchableOpacity>
            </View>
          )
        }} 
      />
      
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={{ marginTop: 15, color: '#666', fontWeight: 'bold' }}>Carregando produtos...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={({ item }) => <ProductCard item={item} onAddToCart={addItem} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[styles.list, { paddingBottom: 150 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#2196F3']} tintColor="#2196F3" />}
        />
      )}

      {/* Backdrop do Carrinho */}
      <Animated.View 
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => toggleSheet(false)} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View 
        style={[styles.bottomSheet, { height: SHEET_HEIGHT, transform: [{ translateY: panY }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => toggleSheet(!isOpen)} style={[styles.sheetHandleArea, { paddingBottom: isOpen ? 12 : 12 + insets.bottom }]}>
          <View style={styles.handleBar} />
          <View style={styles.miniFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.miniFooterText}>{totalItems} itens • </Text>
              {discount > 0 && (
                <Text style={[styles.miniFooterText, { textDecorationLine: 'line-through', color: '#999', fontSize: 14 }]}>R$ {total.toFixed(2)} </Text>
              )}
              <Text style={[styles.miniFooterText, discount > 0 && { color: '#4CAF50' }]}>R$ {displayTotal.toFixed(2)}</Text>
            </View>
            <Text style={styles.expandText}>{isOpen ? 'Arraste para fechar' : 'Puxe para detalhes'}</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={styles.sheetTitle}>Itens no Carrinho</Text>
            <TouchableOpacity onPress={() => setShowClearConfirm(true)} style={styles.clearCartButton}>
              <Ionicons name="trash-outline" size={24} color="#ff5252" />
            </TouchableOpacity>
          </View>
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
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeItem(item.id)}><Text style={styles.removeButtonText}>-</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.inlineAddButton} onPress={() => addItem({ id: item.id, product_id: item.product_id, title: item.title, price: item.price })}><Text style={styles.inlineAddButtonText}>+</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            style={{ maxHeight: SHEET_HEIGHT * 0.4 }}
          />
          
          <View style={styles.sheetFooter}>
            {discount > 0 && (
              <View style={styles.discountRow}>
                <Text style={styles.discountLabel}>Desconto Aplicado:</Text>
                <Text style={styles.discountValue}>- R$ {discount.toFixed(2)}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.confirmButtonLarge} onPress={confirmOrder}>
              <Text style={styles.confirmButtonText}>Finalizar Compra • R$ {displayTotal.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Modal de Confirmação para Limpar Carrinho */}
      <Modal visible={showClearConfirm} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowClearConfirm(false)} />
          <View style={styles.statusBox}>
            <Ionicons name="trash" size={60} color="#ff5252" />
            <Text style={styles.statusText}>Limpar Carrinho?</Text>
            <Text style={styles.statusSubText}>Deseja mesmo remover todos os itens da lista?</Text>
            <TouchableOpacity style={[styles.confirmButtonLarge, {width: '100%', marginTop: 20, backgroundColor: '#ff5252'}]} onPress={handleClearCart}>
              <Text style={styles.confirmButtonText}>Sim, Limpar Tudo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{marginTop: 15}} onPress={() => setShowClearConfirm(false)}>
              <Text style={{color: '#666', fontWeight: 'bold'}}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação para Sair (Logout) */}
      <Modal visible={showLogoutConfirm} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowLogoutConfirm(false)} />
          <View style={styles.statusBox}>
            <Ionicons name="log-out" size={60} color="#f44336" />
            <Text style={styles.statusText}>Sair do Sistema?</Text>
            <Text style={styles.statusSubText}>Você precisará logar novamente para realizar vendas.</Text>
            
            <TouchableOpacity style={[styles.confirmButtonLarge, {width: '100%', marginTop: 20, backgroundColor: '#f44336'}]} onPress={() => handleLogout(false)}>
              <Text style={styles.confirmButtonText}>Sim, Sair agora</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.confirmButtonLarge, {width: '100%', marginTop: 10, backgroundColor: '#666'}]} onPress={() => handleLogout(true)}>
              <Text style={styles.confirmButtonText}>Sair e Limpar Biometria</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{marginTop: 15}} onPress={() => setShowLogoutConfirm(false)}>
              <Text style={{color: '#2196F3', fontWeight: 'bold'}}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Overlay de Loading/Status Global */}
      {(isCartLoading || isValidatingDiscount || statusConfig.visible) && (
        <View style={styles.globalLoadingOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={statusConfig.visible ? hideStatus : undefined} />
          <View style={[styles.statusBox, { marginBottom: insets.bottom + 20 }]}>
            {(isCartLoading || isValidatingDiscount) ? (
              <>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.statusText}>
                  {isValidatingDiscount ? 'Validando Cupom...' : 'Processando Pagamento...'}
                </Text>
                <Text style={styles.statusSubText}>
                  {isValidatingDiscount ? 'Aguarde um momento' : 'Aguarde a resposta da maquininha'}
                </Text>
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
  list: { padding: 8 },
  card: { flex: 1, margin: 8, backgroundColor: '#fff', borderRadius: 12, elevation: 3, overflow: 'hidden' },
  thumbnailContainer: { width: '100%', height: 100, backgroundColor: '#e0e0e0', position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  productTitleOverlay: { position: 'absolute', bottom: 8, left: 8, right: 8, fontSize: 12, fontWeight: 'bold', color: 'black', backgroundColor: 'rgba(255, 255, 255, 0.7)', paddingHorizontal: 4, borderRadius: 4 },
  cardInfo: { padding: 10 },
  productPrice: { fontSize: 16, color: '#4CAF50', fontWeight: 'bold' },
  addButton: { position: 'absolute', right: 8, bottom: 8, backgroundColor: '#2196F3', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.2, shadowRadius: 5 },
  sheetHandleArea: { alignItems: 'center', paddingTop: 12 },
  handleBar: { width: 40, height: 5, backgroundColor: '#e0e0e0', borderRadius: 3, marginBottom: 8 },
  miniFooter: { alignItems: 'center' },
  miniFooterText: { fontSize: 16, fontWeight: 'bold' },
  expandText: { fontSize: 11, color: '#aaa', marginTop: 2 },
  sheetContent: { paddingHorizontal: 20, paddingTop: 10 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold' },
  clearCartButton: { padding: 5 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  cartItemTitle: { fontSize: 15, fontWeight: 'bold' },
  cartItemSub: { fontSize: 13, color: '#666' },
  cartItemTotal: { fontSize: 15, fontWeight: 'bold', marginRight: 12 },
  quantityActions: { flexDirection: 'row', alignItems: 'center' },
  removeButton: { backgroundColor: '#ff5252', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: -2 },
  inlineAddButton: { backgroundColor: '#4CAF50', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  inlineAddButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: -1 },
  sheetFooter: { marginTop: 10 },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 5 },
  discountLabel: { fontSize: 14, color: '#666', fontWeight: 'bold' },
  discountValue: { fontSize: 14, color: '#4CAF50', fontWeight: 'bold' },
  confirmButtonLarge: { backgroundColor: '#4CAF50', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loginCard: { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: '85%' },
  loginTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 15, color: '#000' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingRight: 10 },
  eyeIcon: { padding: 5 },
  globalLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  statusBox: { backgroundColor: '#fff', padding: 30, borderRadius: 24, alignItems: 'center', width: '85%', elevation: 10 },
  statusText: { fontSize: 18, fontWeight: 'bold', marginTop: 15, color: '#333' },
  statusSubText: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
});