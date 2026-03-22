import { NativeModules } from 'react-native';

const { PlugPagClassic } = NativeModules;

export type PaymentInput = {
  amount: number;
  type: number;
  installmentType: number;
  installments: number;
  userReference?: string;
  deviceName?: string;
};

export type PaymentResult = {
  result: number;
  errorCode?: string;
  message?: string;
  transactionCode?: string;
  transactionId?: string;
  hostNsu?: string;
  date?: string;
  time?: string;
  cardBrand?: string;
  bin?: string;
  holder?: string;
  userReference?: string;
  terminalSerialNumber?: string;
  amount?: string;
  availableBalance?: string;
};

export type ActivationResult = {
  result: number;
  errorCode?: string;
  message?: string;
};

function assertModule() {
  if (!PlugPagClassic) {
    throw new Error("Módulo nativo 'PlugPagClassic' não encontrado. Rebuild o app.");
  }
}

export async function activateTerminalNative(activationCode: string, deviceName?: string): Promise<ActivationResult> {
  assertModule();
  return await PlugPagClassic.activateTerminal(activationCode, deviceName ?? null);
}

export async function doPaymentClassic(data: PaymentInput): Promise<PaymentResult> {
  assertModule();
  return await PlugPagClassic.doPaymentClassic(data);
}

export default PlugPagClassic;
