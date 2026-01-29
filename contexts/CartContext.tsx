import React, { createContext, useContext, useState, useEffect } from "react";
import { Alert } from "react-native";
import { initializeAndActivatePinPad, doPayment } from 'react-native-pagseguro-plugpag';
import { log } from '../lib/logging';
import { completePurchase, createPurchase, loginUser, validateDiscount } from "../lib/supabase";
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

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
  token: string | null; // Token do funcionário
  activateTerminal: () => void;
  statusConfig: StatusConfig;
  showStatus: (type: StatusType, title: string, message: string) => void;
  hideStatus: () => void;
  biometricLogin: () => Promise<boolean>;
  hasSavedCredentials: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const SECURE_AUTH_KEY = 'haules_pos_auth';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [finalAmount, setFinalAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState('');
  const [couponId, setCouponId] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [token, setToken] = useState<string | null>(null); // Token do funcionário
  const [customerScanInfo, setCustomerScanInfo] = useState<CustomerScanInfo | null>(null);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  
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
      const savedData = await SecureStore.getItemAsync(SECURE_AUTH_KEY);
      if (savedData) {
        const { timestamp } = JSON.parse(savedData);
        const age = Date.now() - timestamp;
        if (age < SEVEN_DAYS_MS) {
          setHasSavedCredentials(true);
        } else {
          await SecureStore.deleteItemAsync(SECURE_AUTH_KEY);
          setHasSavedCredentials(false);
        }
      }
    } catch (e) {
      setHasSavedCredentials(false);
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
      await log('Checkpoint 1: Verificando se as funções da SDK existem...');
      if (typeof initializeAndActivatePinPad !== 'function') {
        throw new Error('Função initializeAndActivatePinPad não encontrada na lib!');
      }
      await log('SDK detectada. Chamando initializeAndActivatePinPad com código 403938...');

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: A SDK da PagSeguro não respondeu em 5s.')), 5000)
      );

      const activationPromise = initializeAndActivatePinPad('403938');
      const data: any = await Promise.race([activationPromise, timeoutPromise]);
      
      await log(`Checkpoint 2: Resposta recebida da SDK: ${JSON.stringify(data)}`);

      if (data.result !== 0) {
        Alert.alert('Erro na Ativação', data.errorMessage || 'Erro desconhecido na SDK.');
        await log(`Falha reportada pela SDK: ${data.errorMessage}`, 'ERROR');
        return;
      }

      Alert.alert('Sucesso!', `Terminal ${data.terminalId} ativado.`);
      await log(`Terminal ativado com sucesso! ID: ${data.terminalId}`);
    } catch (error: any) {
      const errorMsg = error.message || 'Erro desconhecido';
      await log(`ERRO NO FLUXO DE ATIVAÇÃO: ${errorMsg}`, 'ERROR');
      Alert.alert('Erro de Ativação', errorMsg);
      console.error('Erro na ativação:', error);
    } finally {
      await log('--- FIM DO PROCESSO DE ATIVAÇÃO ---');
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
        await SecureStore.setItemAsync(SECURE_AUTH_KEY, JSON.stringify({
          email,
          pass,
          timestamp: Date.now()
        }));
        setHasSavedCredentials(true);
      }
    }
    return response;
  };

  const biometricLogin = async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        showStatus('warning', 'Biometria', 'Biometria não disponível ou não configurada.');
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login Haules PoS',
        fallbackLabel: 'Usar Senha',
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
    } catch (e) {
      console.error('Erro na biometria:', e);
      return false;
    }
  };

  const validateDiscountCode = async (couponId: string, userId: string, itemsInCart: ItemsInCartType) => {
    if (!token) {
      showStatus('warning', 'Ação Necessária', 'Por favor, faça o login de funcionário para validar um cupom.');
      return;
    }
    setCouponId(couponId);
    setIsValidatingDiscount(true);
    const [error, response] = await validateDiscount(couponId, total, userId, token, itemsInCart);

    if (error) {
      await log(`Erro ao validar código de desconto: ${String(error)}`, 'ERROR');
      showStatus('error', 'Erro no Cupom', String(error));
      setIsValidatingDiscount(false);
      return;
    }
    
    setDiscount(response?.discountValue || 0);
    setFinalAmount(response?.discountedAmount || 0);
    setCoupon(response?.code || '');
    setIsValidatingDiscount(false);
  };

  const handleConfirmOrder = async () => {
    await log('\n' + '='.repeat(40));
    await log('INICIANDO NOVO PEDIDO');
    if (items.length === 0) {
      await log('Carrinho vazio, abortando.', 'WARN');
      showStatus('warning', 'Carrinho Vazio', 'Adicione itens antes de finalizar.');
      await log('='.repeat(40) + '\n');
      return;
    }
  
    if (!token) {
      await log('Funcionário não logado, abortando.', 'WARN');
      showStatus('warning', 'Login Necessário', 'Funcionário não está logado.');
      await log('='.repeat(40) + '\n');
      return;
    }
  
    setIsLoading(true);
    const emailToUse = customerScanInfo?.email || "funcionario@bar.com";
    await log(`Config: Email: ${emailToUse}, Itens: ${items.length}, Total: R$ ${total.toFixed(2)}`);
    
    const purchaseData = {
      items: items.map((item) => ({
        variant_id: item.id,
        quantity: item.quantity,
      })),
      email: emailToUse,
      promo_codes: coupon ? [coupon] : undefined,
      customer_id: customerScanInfo?.userId,
      discount_id: couponId || undefined,
      region_id: process.env.EXPO_PUBLIC_REGION_ID!,
    };
  
    await log('Executando Passo 1 (Medusa) e Passo 2 (PagSeguro) em paralelo...');
    
    const amountToCharge = finalAmount > 0 ? finalAmount : total;
    const amountInCents = Math.round(amountToCharge * 100);

    if (amountInCents <= 0) {
      showStatus('warning', 'Valor Inválido', 'O valor da compra deve ser maior que zero.');
      setIsLoading(false);
      await log('='.repeat(40) + '\n');
      return;
    }

    const performPayment = async () => {
      const startTime = Date.now();
      await log(`[PAGAMENTO] INÍCIO - Solicitando R$${amountToCharge.toFixed(2)} na maquininha...`);
      console.log(`[PAGAMENTO] Iniciou às: ${new Date(startTime).toLocaleTimeString()}`);
      
      // SIMULAÇÃO PARA TESTE LOCAL (8 SEGUNDOS)
      return await new Promise((resolve) => {
        setTimeout(() => {
          const endTime = Date.now();
          const duration = (endTime - startTime) / 1000;
          console.log(`[PAGAMENTO] Finalizou às: ${new Date(endTime).toLocaleTimeString()} (Duração: ${duration}s)`);
          log(`[PAGAMENTO] SUCESSO SIMULADO após ${duration}s.`);
          resolve({ result: 0, terminalId: 'SIMULADO_LOCAL' });
        }, 8000);
      }) as any;

      /* CHAMADA REAL COMENTADA:
      return await doPayment({
        amount: amountInCents,
        type: plugPag.paymentTypes.CREDIT,
        printReceipt: true,
        installments: 1,
        installmentType: plugPag.installmentTypes.BUYER_INSTALLMENT,
        userReference: "haules-pos",
      });
      */
    };

    try {
      const medusaStartTime = Date.now();
      const [createResponseResult, paymentResponse]: [any, any] = await Promise.all([
        createPurchase(purchaseData, token).then(res => {
          const medusaEndTime = Date.now();
          if (res[0]) throw new Error(`Erro Medusa: ${JSON.stringify(res[0])}`);
          return res[1];
        }),
        performPayment()
      ]);

      await log(`[MAQUININHA] Resposta: ${JSON.stringify(paymentResponse)}`);
      if (paymentResponse.result !== 0) {
        throw new Error(paymentResponse.errorMessage || 'Pagamento na maquininha falhou.');
      }
      
      await log("[SUCESSO] Pagamento aprovado e Pedido criado.");

      const orderId = createResponseResult.order.id;
      const currentTotal = total;
      const currentCouponId = couponId;

      setIsLoading(false);
      showStatus('success', 'Pagamento Aprovado', 'Pedido finalizado com sucesso.');
      clearCart();

      (async () => {
        try {
          const [completeError, completeResponse] = await completePurchase(orderId, currentCouponId, currentTotal, token);
          if (completeError) {
            await log(`[BACKGROUND ERROR] Falha no pedido ${orderId}: ${JSON.stringify(completeError)}`, 'ERROR');
          } else {
            await log(`[BACKGROUND SUCCESS] Pedido ${orderId} finalizado.`);
          }
        } catch (bgError: any) {
          await log(`[BACKGROUND CRITICAL] Erro no pedido ${orderId}: ${bgError.message}`, 'ERROR');
        } finally {
          await log('='.repeat(40) + '\n');
        }
      })();

    } catch (error: any) {
      await log(`[ERRO CRÍTICO] ${error.message}`, 'ERROR');
      showStatus('error', 'Falha na Transação', error.message);
      setIsLoading(false);
      await log('='.repeat(40) + '\n');
    }
  };

  const applyCoupon = (couponId: string, userId: string, customerEmail: string) => {
    setCustomerScanInfo({ userId, email: customerEmail });
    const mappedItemsInCart = items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    validateDiscountCode(couponId, userId, mappedItemsInCart);
  };

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: (i.quantity || 0) + (item.quantity || 1) } : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => {
      const updatedItems = prev
        .map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        )
        .filter((i) => i.quantity > 0);

      const newTotal = updatedItems.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );

      if (coupon) {
        setDiscount(0);
        setFinalAmount(newTotal);
        setCoupon('');
      }
      return updatedItems;
    });
  };

  const clearCart = () => {
    setDiscount(0);
    setFinalAmount(0);
    setCoupon('');
    setItems([]);
    setCustomerScanInfo(null);
  };

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items, addItem, removeItem, total, clearCart, confirmOrder: handleConfirmOrder, 
        isLoading, applyCoupon, finalAmount, discount, isValidatingDiscount, login: handleLogin, 
        token, activateTerminal: handleActivateTerminal,
        statusConfig, showStatus, hideStatus, biometricLogin, hasSavedCredentials
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
