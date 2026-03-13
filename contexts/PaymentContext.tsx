import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { useUI } from './UIContext';
import { initializeAndActivatePinPad } from 'react-native-pagseguro-plugpag';
import { doPaymentClassic, PaymentTypes, InstallmentTypes, PlugPagClassicPaymentInput } from '../lib/plugpagClassic';
import { createPurchase, completePurchase } from '../lib/supabase';
import { Alert } from 'react-native';

export type PaymentType = typeof PaymentTypes[keyof typeof PaymentTypes];
export type InstallmentType = typeof InstallmentTypes[keyof typeof InstallmentTypes];

type PaymentContextType = {
  activateTerminal: () => Promise<void>;
  confirmOrder: () => void;
  proceedToPayment: () => Promise<void>;
  showPaymentModal: boolean;
  setShowPaymentModal: (show: boolean) => void;
  showInstallmentModal: boolean;
  setShowInstallmentModal: (show: boolean) => void;
  selectedPaymentType: PaymentType | null;
  selectPaymentType: (type: PaymentType) => void;
  selectedInstallmentType: InstallmentType | null;
  selectInstallmentType: (type: InstallmentType) => void;
  installments: number;
  setInstallments: (value: number) => void;
  isProcessingPayment: boolean;
};

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export const PaymentProvider = ({ children }: { children: ReactNode }) => {
  const { token, employeeCustomerId } = useAuth();
  const { items, total, finalAmount, clearCart, coupon, couponId, discount, customerScanInfo } = useCart();
  const { showStatus, setIsLoading } = useUI();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType | null>(null);
  const [selectedInstallmentType, setSelectedInstallmentType] = useState<InstallmentType | null>(null);
  const [installments, setInstallments] = useState(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const activateTerminal = async () => {
    setIsLoading(true);
    try {
      if (typeof initializeAndActivatePinPad !== 'function') throw new Error('SDK não encontrada!');
      
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT SDK')), 5000));
      const activationPromise = initializeAndActivatePinPad('403938');
      
      const data: any = await Promise.race([activationPromise, timeoutPromise]);
      
      if (data.result !== 0) throw new Error(data.errorMessage);
      
      showStatus('success', 'Terminal Ativado', `Terminal ${data.terminalId} pronto.`);
    } catch (error: any) {
      showStatus('error', 'Erro na Ativação', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmOrder = () => {
    if (items.length === 0) {
      showStatus('warning', 'Carrinho Vazio', 'Adicione itens antes de finalizar.');
      return;
    }
    if (!token) {
      showStatus('warning', 'Login Necessário', 'Faça login para continuar.');
      return;
    }
    setShowPaymentModal(true);
  };

  const selectPaymentType = (type: PaymentType) => {
    setSelectedPaymentType(type);
    setShowPaymentModal(false);
    
    if (type === PaymentTypes.DEBIT) {
      setSelectedInstallmentType(InstallmentTypes.NO_INSTALLMENT);
      setInstallments(1);
      setShowInstallmentModal(true); // Ou ir direto, mas modal confirma
    } else {
      setShowInstallmentModal(true);
    }
  };

  const selectInstallmentType = (type: InstallmentType) => {
    setSelectedInstallmentType(type);
    if (type === InstallmentTypes.NO_INSTALLMENT) {
      setInstallments(1);
      // Se quiser pular direto:
      setShowInstallmentModal(false);
      executePaymentFlow();
    } else if (installments < 2) {
      setInstallments(2);
    }
  };

  const proceedToPayment = async () => {
    setShowInstallmentModal(false);
    await executePaymentFlow();
  };

  const executePaymentFlow = async () => {
    if (!selectedPaymentType || !selectedInstallmentType || !token || !employeeCustomerId) {
      showStatus('error', 'Dados Incompletos', 'Verifique login e forma de pagamento.');
      return;
    }

    setIsLoading(true);
    setIsProcessingPayment(true);

    try {
      // 1. Cria Pedido no Medusa (Pending)
      const purchaseData = {
        items: items.map((item) => ({ variant_id: item.id, quantity: item.quantity })),
        promo_codes: coupon ? [coupon] : undefined,
        customer_id: employeeCustomerId,
        discount_id: couponId || undefined,
        region_id: process.env.EXPO_PUBLIC_REGION_ID!,
        metadata: {
          scanned_customer_email: customerScanInfo?.email,
        }
      };

      const [medusaError, medusaData] = await createPurchase(purchaseData, token);
      
      if (medusaError) throw new Error(`Erro ao criar pedido: ${JSON.stringify(medusaError)}`);

      const orderId = medusaData.order.id;
      const orderTotal = medusaData.order.total; // Total vindo do backend (mais seguro)

      // 2. Cobra na Maquininha (Moderninha Plus 2 via Bluetooth)
      const amountInCents = Math.round(finalAmount * 100); // Usa o total local calculado
      
      const paymentParams: PlugPagClassicPaymentInput = {
        amount: amountInCents,
        type: selectedPaymentType,
        installments: selectedPaymentType === PaymentTypes.DEBIT ? 1 : installments,
        installmentType: selectedInstallmentType,
        printReceipt: true,
        userReference: `PEDIDO_${orderId.substring(0, 8)}`,
      };

      const paymentResult = await doPaymentClassic(paymentParams);

      if (paymentResult.result !== 0) {
        throw new Error(paymentResult.errorMessage || 'Pagamento não autorizado.');
      }

      // 3. Completa Pedido no Medusa (Se sucesso na máquina)
      await completePurchase(orderId, couponId, orderTotal, process.env.EXPO_PUBLIC_REGION_ID!, token);

      showStatus('success', 'Venda Concluída!', `Pedido ${orderId} registrado.`);
      clearCart();
      
    } catch (error: any) {
      console.error(error);
      showStatus('error', 'Falha na Transação', error.message);
    } finally {
      setIsLoading(false);
      setIsProcessingPayment(false);
    }
  };

  return (
    <PaymentContext.Provider value={{
      activateTerminal, confirmOrder, proceedToPayment,
      showPaymentModal, setShowPaymentModal,
      showInstallmentModal, setShowInstallmentModal,
      selectedPaymentType, selectPaymentType,
      selectedInstallmentType, selectInstallmentType,
      installments, setInstallments,
      isProcessingPayment
    }}>
      {children}
    </PaymentContext.Provider>
  );
};

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) throw new Error('usePayment must be used within a PaymentProvider');
  return context;
};
