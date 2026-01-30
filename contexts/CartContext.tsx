import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import plugPag, { doPayment, initializeAndActivatePinPad } from 'react-native-pagseguro-plugpag';
import { log } from '../lib/logging';
import { completePurchase, createPurchase, loginUser, validateDiscount } from "../lib/supabase";

export type CartItem = {
  id: string; // Este será o variant_id
  product_id: string; // Novo campo para o ID do produto
  title: string;
  quantity: number;
  price: number;
};

type ItemsInCartType = {
  product_id: string;
  quantity: number;
}[];

type CustomerScanInfo = {
  userId: string;
  email: string;
};

export type StatusType = 'success' | 'error' | 'info' | 'warning';

export type StatusConfig = {
  visible: boolean;
  type: StatusType;
  title: string;
  message: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (itemId: string) => void;
  total: number;
  clearCart: () => void;
  confirmOrder: () => void;
  isLoading: boolean;
  applyCoupon: (couponId: string, userId: string, customerEmail: string) => void;
  finalAmount: number;
  discount: number;
  isValidatingDiscount: boolean;
  login: (email: string, pass: string, saveSecurely?: boolean) => Promise<any>;
  logout: (forgetMe?: boolean) => Promise<void>;
  token: string | null;
  activateTerminal: () => void;
  statusConfig: StatusConfig;
  showStatus: (type: StatusType, title: string, message: string) => void;
  hideStatus: () => void;
  biometricLogin: () => Promise<boolean>;
  hasSavedCredentials: boolean;
  isInitialLoading: boolean;
  isBiometricSupported: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const SECURE_AUTH_KEY = 'haules_pos_auth';
const BIOMETRIC_ENABLED_KEY = 'haules_pos_biometric_enabled';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState('');
  const [couponId, setCouponId] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [customerScanInfo, setCustomerScanInfo] = useState<CustomerScanInfo | null>(null);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  
  const [statusConfig, setStatusConfig] = useState<StatusConfig>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  useEffect(() => {
    checkSavedCredentials();
  }, []);

  const checkSavedCredentials = async () => {
    try {
      // Checa suporte de hardware primeiro
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supported = hasHardware && isEnrolled;
      setIsBiometricSupported(supported);

      const biometricEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      
      // Só tenta recuperar credenciais se tiver suporte E estiver habilitado
      if (biometricEnabled === 'true' && supported) {
        const savedData = await SecureStore.getItemAsync(SECURE_AUTH_KEY);
        if (savedData) {
          const { timestamp } = JSON.parse(savedData);
          const age = Date.now() - timestamp;
          if (age < SEVEN_DAYS_MS) {
            setHasSavedCredentials(true);
          } else {
            await SecureStore.deleteItemAsync(SECURE_AUTH_KEY);
            await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
            setHasSavedCredentials(false);
          }
        }
      } else {
        setHasSavedCredentials(false);
      }
    } catch (e) {
      setHasSavedCredentials(false);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const showStatus = (type: StatusType, title: string, message: string) => {
    setStatusConfig({ visible: true, type, title, message });
    if (type === 'success' || type === 'info') {
      setTimeout(() => hideStatus(), 2500);
    }
  };

  const hideStatus = () => {
    setStatusConfig(prev => ({ ...prev, visible: false }));
  };

  const handleActivateTerminal = async () => {
    await log('--- INÍCIO DO PROCESSO DE ATIVAÇÃO ---');
    Alert.alert('Ativação', 'Iniciando ativação... Verifique os Logs se demorar.');
    try {
      if (typeof initializeAndActivatePinPad !== 'function') throw new Error('SDK não encontrada!');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT SDK')), 5000));
      const activationPromise = initializeAndActivatePinPad('403938');
      const data: any = await Promise.race([activationPromise, timeoutPromise]);
      if (data.result !== 0) throw new Error(data.errorMessage);
      Alert.alert('Sucesso!', `Terminal ${data.terminalId} ativado.`);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    }
  };

  const handleLogin = async (email: string, pass: string, saveSecurely: boolean = true) => {
    const [error, response] = await loginUser(email, pass);
    if (error) {
      showStatus('error', 'Erro no Login', String(error));
      return;
    }
    if (response) {
      setToken(response.token);
      if (saveSecurely) {
        // Verifica suporte antes de tentar salvar como "biometria ativada"
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        if (hasHardware && isEnrolled) {
          await SecureStore.setItemAsync(SECURE_AUTH_KEY, JSON.stringify({ email, pass, timestamp: Date.now() }));
          await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
          setHasSavedCredentials(true);
        }
      }
    }
    return response;
  };

  const handleLogout = async (forgetMe: boolean = false) => {
    setToken(null);
    clearCart();
    if (forgetMe) {
      await SecureStore.deleteItemAsync(SECURE_AUTH_KEY);
      await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      setHasSavedCredentials(false);
    }
  };

  const biometricLogin = async (): Promise<boolean> => {
    try {
      // Redundância de segurança: checa tudo de novo antes de chamar
      const biometricEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      if (biometricEnabled !== 'true') return false;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        return false;
      }

      // Delay para estabilizar UI
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await LocalAuthentication.authenticateAsync({ 
        promptMessage: 'Autenticação Haules PoS',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const savedData = await SecureStore.getItemAsync(SECURE_AUTH_KEY);
        if (savedData) {
          const { email, pass } = JSON.parse(savedData);
          const response = await handleLogin(email, pass, false);
          return !!response;
        }
      }
      return false;
    } catch (e: any) { 
      return false; 
    }
  };

  const validateDiscountCode = async (couponId: string, userId: string, itemsInCart: ItemsInCartType) => {
    if (!token) {
      showStatus('warning', 'Ação Necessária', 'Por favor, faça o login de funcionário.');
      return;
    }
    setCouponId(couponId);
    setIsValidatingDiscount(true);
    const [error, response] = await validateDiscount(couponId, total, userId, token, itemsInCart);
    if (error) {
      showStatus('error', 'Erro no Cupom', String(error));
      setIsValidatingDiscount(false);
      return;
    }
    setDiscount(response?.discountValue || 0);
    setCoupon(response?.code || '');
    setIsValidatingDiscount(false);
    showStatus('success', 'Cupom Aplicado!', `Desconto de R$ ${(response?.discountValue || 0).toFixed(2)}`);
  };

  const handleConfirmOrder = async () => {
    if (items.length === 0 || !token) return;
    setIsLoading(true);
    const purchaseData = {
      items: items.map((item) => ({ variant_id: item.id, quantity: item.quantity })),
      email: customerScanInfo?.email || "funcionariohaules+100@gmail.com",
      promo_codes: coupon ? [coupon] : undefined,
      customer_id: customerScanInfo?.userId,
      discount_id: couponId || undefined,
      region_id: process.env.EXPO_PUBLIC_REGION_ID!,
    };
    console.log('purchaseData:', purchaseData)
    console.log('coupon:', coupon)
  
    const performPayment = async () => {
      // SIMULAÇÃO PARA TESTE LOCAL (8 SEGUNDOS)
      // return await new Promise((resolve) => {
      //   setTimeout(() => resolve({ result: 0, terminalId: 'SIMULADO_LOCAL' }), 8000);
      // }) as any;


      const amountInCents = Math.round(finalAmount * 100);
      return await doPayment({
        amount: amountInCents,
        type: plugPag.paymentTypes.CREDIT,
        printReceipt: true,
        installments: 1,
        installmentType: plugPag.installmentTypes.BUYER_INSTALLMENT,
        userReference: "haules-pos",
      });

    };

    try {
      const [createResponseResult, paymentResponse]: [any, any] = await Promise.all([
        createPurchase(purchaseData, token).then(res => {
          if (res[0]) throw new Error(`Erro Medusa: ${JSON.stringify(res[0])}`);
          return res[1];
        }),
        performPayment()
      ]);

      if (paymentResponse.result !== 0) throw new Error(paymentResponse.errorMessage);
      
      const orderId = createResponseResult.order.id;
      const currentTotal = total;
      const currentCouponId = couponId;

      setIsLoading(false);
      showStatus('success', 'Pagamento Aprovado', 'Pedido finalizado com sucesso.');
      clearCart();

      (async () => {
        try {
          await completePurchase(orderId, currentCouponId, currentTotal, token);
        } catch (bgError) { /* Logged in Medusa */ }
      })();

    } catch (error: any) {
      showStatus('error', 'Falha na Transação', error.message);
      setIsLoading(false);
    }
  };

  const applyCoupon = (couponId: string, userId: string, customerEmail: string) => {
    setCustomerScanInfo({ userId, email: customerEmail });
    const mappedItemsInCart = items.map(item => ({ product_id: item.product_id, quantity: item.quantity }));
    validateDiscountCode(couponId, userId, mappedItemsInCart);
  };

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.map((i) => i.id === item.id ? { ...i, quantity: (i.quantity || 0) + (item.quantity || 1) } : i);
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    if (coupon) {
      setDiscount(0);
      setCoupon('');
      setCouponId('');
    }
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0));
  };

  const clearCart = () => {
    setDiscount(0);
    setCoupon('');
    setCouponId('');
    setItems([]);
    setCustomerScanInfo(null);
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const finalAmount = Math.max(0, total - discount);

  return (
    <CartContext.Provider
      value={{
        items, addItem, removeItem, total, clearCart, confirmOrder: handleConfirmOrder, 
        isLoading, applyCoupon, finalAmount, discount, isValidatingDiscount, login: handleLogin, 
        logout: handleLogout, token, activateTerminal: handleActivateTerminal,
        statusConfig, showStatus, hideStatus, biometricLogin, hasSavedCredentials, isInitialLoading
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};
