import * as PlugPagModule from "../modules/plugpag-classic";

export async function activateTerminal(activationCode: string, deviceName?: string) {
  return await PlugPagModule.activateTerminalNative(activationCode, deviceName);
}

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
  // O SDK da PagSeguro exige valores INTEIROS (centavos)
  const amountInCents = Math.round(data.amount);

  const paymentParams: PlugPagModule.PaymentInput = {
    amount: amountInCents,
    type: data.type,
    installmentType: data.installmentType,
    installments: data.installments,
    userReference: data.userReference || "haules-pos",
    // deviceName opcional: se passado, o SDK tenta conectar especificamente nele
    ...(data.deviceName ? { deviceName: data.deviceName } : {}),
  };

  console.log("[PlugPagClassic] Disparando cobrança (Expo Module):", JSON.stringify(paymentParams));

  try {
    /**
     * Agora chamamos diretamente o método do nosso Expo Module local.
     * O novo módulo já recebe o objeto direto (ReadableMap no Kotlin), 
     * não precisa mais de JSON.stringify.
     */
    const result = await PlugPagModule.doPaymentClassic(paymentParams);
    
    // Padronização da resposta de erro do SDK (usando 'message' que vem do nativo)
    if (result && result.result !== 0) {
      return {
        ...result,
        message: result.message || "Transação cancelada ou falhou.",
      };
    }
    
    return result;
  } catch (error: any) {
    console.error("[PlugPagClassic] Erro crítico na transação:", error);
    throw new Error(error.message || "Erro na comunicação Bluetooth com a maquininha.");
  }
}
