import { NativeModules } from "react-native";

/**
 * A biblioteca instalada (react-native-pagseguro-plugpag) 
 * registra o módulo nativo como 'PagseguroPlugpag'.
 */
const { PagseguroPlugpag } = NativeModules;

export const PaymentTypes = {
  CREDIT: 1,
  DEBIT: 2,
  VOUCHER: 3,
  PIX_QR_CODE: 5,
} as const;

export type PaymentType = (typeof PaymentTypes)[keyof typeof PaymentTypes];

export const InstallmentTypes = {
  NO_INSTALLMENT: 1,
  SELLER_INSTALLMENT: 2,
  BUYER_INSTALLMENT: 3,
} as const;

export type InstallmentType =
  (typeof InstallmentTypes)[keyof typeof InstallmentTypes];

export type PlugPagClassicPaymentInput = {
  amount: number;
  type: PaymentType;
  installmentType: InstallmentType;
  installments: number;
  printReceipt?: boolean;
  userReference?: string;
  deviceName?: string; // Opcional para Bluetooth
};

/**
 * Função principal para disparar a cobrança na maquininha.
 * GARANTIDO para Moderninha Plus 2 (D190) via Bluetooth.
 * 
 * ATENÇÃO: A maquininha PRECISA estar pareada no Bluetooth do Android.
 */
export async function doPaymentClassic(data: PlugPagClassicPaymentInput) {
  if (!PagseguroPlugpag) {
    throw new Error(
      "Módulo nativo 'PagseguroPlugpag' não encontrado. " +
      "Rebuild o app usando 'npx expo run:android' para ativar as dependências nativas."
    );
  }

  // O SDK da PagSeguro exige valores INTEIROS (centavos)
  const amountInCents = Math.round(data.amount);

  const paymentParams = {
    amount: amountInCents,
    type: data.type,
    installmentType: data.installmentType,
    installments: data.installments,
    printReceipt: data.printReceipt ?? true, // Padrão: Imprimir via app/maquina se suportado
    userReference: data.userReference || "haules-pos",
    // deviceName opcional: se passado, o SDK tenta conectar especificamente nele
    ...(data.deviceName ? { deviceName: data.deviceName } : {}),
  };

  console.log("[PlugPagClassic] Disparando cobrança (Raw Data):", JSON.stringify(paymentParams));

  try {
    /**
     * O SDK nativo do PagSeguro via Wrapper espera um JSON stringificado
     * conforme visto no arquivo index.tsx da biblioteca.
     */
    const dataFormatted = JSON.stringify(paymentParams);
    const result = await PagseguroPlugpag.doPayment(dataFormatted);
    
    // Padronização da resposta de erro do SDK
    if (result && result.result !== 0) {
      return {
        ...result,
        errorMessage: result.message || result.errorMessage || "Transação cancelada ou falhou.",
      };
    }
    
    return result;
  } catch (error: any) {
    console.error("[PlugPagClassic] Erro crítico na transação:", error);
    throw new Error(error.message || "Erro na comunicação Bluetooth com a maquininha.");
  }
}
