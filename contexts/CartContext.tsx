import React, { createContext, useContext, useState, ReactNode } from 'react';
import { validateDiscount } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';

export type CartItem = {
  id: string; // Variant ID
  product_id: string;
  title: string;
  quantity: number;
  price: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  total: number;
  finalAmount: number;
  discount: number;
  coupon: string;
  couponId: string;
  applyCoupon: (couponCode: string, customerId?: string) => Promise<void>;
  isValidatingDiscount: boolean;
  customerScanInfo: { userId: string; email: string } | null;
  setCustomerScanInfo: (info: { userId: string; email: string } | null) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  const { showStatus } = useUI();
  
  const [items, setItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState('');
  const [couponId, setCouponId] = useState('');
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [customerScanInfo, setCustomerScanInfo] = useState<{ userId: string; email: string } | null>(null);

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
    // Se remover item, limpa cupom pra evitar inconsistência
    if (coupon) {
      setDiscount(0);
      setCoupon('');
      setCouponId('');
    }
    setItems((prev) => 
      prev.map((i) => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i)
          .filter((i) => i.quantity > 0)
    );
  };

  const clearCart = () => {
    setDiscount(0);
    setCoupon('');
    setCouponId('');
    setItems([]);
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const finalAmount = Math.max(0, total - discount);

  const applyCoupon = async (couponCode: string, customerId?: string) => {
    if (!token) {
      showStatus('warning', 'Login Necessário', 'Faça login para aplicar cupons.');
      return;
    }
    
    setIsValidatingDiscount(true);
    const itemsPayload = items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
    
    const [error, response] = await validateDiscount(couponCode, total, customerId || '', token, itemsPayload);
    
    setIsValidatingDiscount(false);
    
    if (error) {
      showStatus('error', 'Erro no Cupom', String(error));
      setDiscount(0);
      setCoupon('');
      return;
    }

    if (response) {
      setDiscount(response.discountValue);
      setCoupon(response.code);
      setCouponId(couponCode); // Assumindo que o código é o ID ou que a resposta traga o ID
      showStatus('success', 'Cupom Aplicado!', `Desconto de R$ ${response.discountValue.toFixed(2)}`);
    }
  };

  return (
    <CartContext.Provider value={{ 
      items, addItem, removeItem, clearCart, total, finalAmount, 
      discount, coupon, couponId, applyCoupon, isValidatingDiscount,
      customerScanInfo, setCustomerScanInfo
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
