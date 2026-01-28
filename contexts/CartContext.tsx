import React, { createContext, useContext, useState } from "react";
import { Alert } from "react-native";
import { plugPag, doPayment } from 'react-native-pagseguro-plugpag';
import { validateDiscount, loginUser, createPurchase, completePurchase } from "../lib/supabase";
import { log } from '../lib/logging';

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
  login: (email: string, pass: string) => Promise<any>;
  token: string | null;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

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

  const handleLogin = async (email: string, pass: string) => {
    const [error, response] = await loginUser(email, pass);
    if (error) {
      alert(`Erro no login: ${error}`);
      return;
    }
    if (response) {
      setToken(response.token);
      alert("Login bem-sucedido!");
    }
    return response;
  };

  const validateDiscountCode = async (couponId: string, userId: string, itemsInCart: ItemsInCartType) => {
    if (!token) {
      alert("Por favor, faça o login de funcionário para validar um cupom.");
      return;
    }
    setCouponId(couponId);
    setIsValidatingDiscount(true);
    // Usa o token do funcionário para a validação
    const [error, response] = await validateDiscount(couponId, total, userId, token, itemsInCart);

    if (error) {
      await log(`Erro ao validar código de desconto: ${error}`, 'ERROR');
      alert(error);
      setIsValidatingDiscount(false);
      return;
    }
    
    setDiscount(response?.discountValue || 0);
    setFinalAmount(response?.discountedAmount || 0);
    setCoupon(response?.code || '');
    setIsValidatingDiscount(false);
  };

  const handleConfirmOrder = async () => {
    await log('Iniciando handleConfirmOrder.');
    if (items.length === 0) {
      await log('Carrinho vazio, abortando.', 'WARN');
      alert("O carrinho está vazio.");
      return;
    }
  
    if (!token) {
      await log('Funcionário não logado, abortando.', 'WARN');
      alert("Funcionário não está logado. Impossível confirmar o pedido.");
      return;
    }
  
    setIsLoading(true);
    const emailToUse = customerScanInfo?.email || "funcionario@bar.com";
    await log(`Iniciando confirmação do pedido para email: ${emailToUse}. Itens: ${items.length}, Total: ${total}`);
    
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
  
    // 1. Create the initial order record
    await log('Passo 1: Criando pedido inicial no Medusa...');
    const [createError, createResponse] = await createPurchase(purchaseData, token);
  
    if (createError || !createResponse?.order.id) {
      await log(`Falha ao criar pedido no Medusa. Erro: ${JSON.stringify(createError)}`, 'ERROR');
      alert(`Erro ao criar pedido: ${JSON.stringify(createError)}`);
      setIsLoading(false);
      return;
    }
    await log(`Pedido inicial criado com sucesso no Medusa. Order ID: ${createResponse.order.id}`);

    // 2. Integração com a maquininha PagSeguro
    await log('Passo 2: Iniciando integração com PagSeguro...');
    try {
      const amountToCharge = finalAmount > 0 ? finalAmount : total;
      const amountInCents = Math.round(amountToCharge * 100);

      if (amountInCents <= 0) {
        throw new Error("O valor da compra deve ser maior que zero.");
      }

      await log(`Tentando cobrar R$${amountToCharge.toFixed(2)} (${amountInCents} centavos) na maquininha.`);

      const paymentResponse = await doPayment({
        amount: amountInCents,
        type: plugPag.paymentTypes.CREDIT,
        printReceipt: true,
        installments: 1,
        installmentType: plugPag.installmentTypes.BUYER_INSTALLMENT,
        userReference: "haules-pos",
      });

      await log(`Resposta da maquininha: ${JSON.stringify(paymentResponse)}`);

      // Verifique a resposta da maquininha. Se o pagamento falhar, lance um erro.
      if (paymentResponse.result !== 0) {
        throw new Error(paymentResponse.errorMessage || 'Pagamento na maquininha falhou.');
      }

      await log("Pagamento na maquininha APROVADO.");

    } catch (paymentError: any) {
      await log(`ERRO durante o pagamento na maquininha: ${paymentError.message}`, 'ERROR');
      alert(`A transação na maquininha falhou: ${paymentError.message}`);
      setIsLoading(false); // Libera o loading
      return; // Interrompe a execução
    }

    // 3. Complete the purchase in Medusa (só executa se o pagamento acima for bem-sucedido)
    await log('Passo 3: Completando pedido no Medusa...');
    const orderId = createResponse.order.id;
    const [completeError, completeResponse] = await completePurchase(orderId, couponId, total, token);

    setIsLoading(false);

    if (completeError) {
      await log(`ERRO ao completar pedido no Medusa. OrderId: ${orderId}. Erro: ${JSON.stringify(completeError)}`, 'ERROR');
      alert(`Erro ao completar pedido: ${JSON.stringify(completeError)}`);
      // TODO: Add logic to handle the failed completion, e.g., cancel the created order.
      return;
    }
  
    await log(`Pedido ${orderId} finalizado com SUCESSO!`);
    alert(`Pedido criado com sucesso!`);
    clearCart();
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
    log('Limpando o carrinho.');
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
      value={{ items, addItem, removeItem, total, clearCart, confirmOrder: handleConfirmOrder, isLoading, applyCoupon, finalAmount, discount, isValidatingDiscount, login: handleLogin, token }}
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
