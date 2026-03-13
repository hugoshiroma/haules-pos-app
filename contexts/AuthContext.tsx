import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginEmployee } from '../lib/supabase';
import { useUI } from './UIContext';

const SECURE_AUTH_KEY = 'haules_pos_auth';
const BIOMETRIC_ENABLED_KEY = 'haules_pos_biometric_enabled';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type AuthContextType = {
  token: string | null;
  employeeName: string | null;
  employeeCustomerId: string | null;
  login: (email: string, pass: string, saveSecurely?: boolean) => Promise<any>;
  logout: (forgetMe?: boolean) => Promise<void>;
  biometricLogin: () => Promise<boolean>;
  hasSavedCredentials: boolean;
  isInitialLoading: boolean;
  isBiometricSupported: boolean;
  biometricDebugInfo: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { showStatus, setIsLoading } = useUI();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employeeCustomerId, setEmployeeCustomerId] = useState<string | null>(null);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricDebugInfo, setBiometricDebugInfo] = useState('');

  useEffect(() => {
    checkSavedCredentials();
  }, []);

  const checkSavedCredentials = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supported = hasHardware && isEnrolled;
      setIsBiometricSupported(supported);
      setBiometricDebugInfo(`HW:${hasHardware} Enr:${isEnrolled}`);

      const biometricEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      
      if (biometricEnabled === 'true' && supported) {
        const savedData = await SecureStore.getItemAsync(SECURE_AUTH_KEY);
        if (savedData) {
          const { timestamp } = JSON.parse(savedData);
          const age = Date.now() - timestamp;
          if (age < SEVEN_DAYS_MS) {
            setHasSavedCredentials(true);
          } else {
            // Sessão expirada
            await clearSecureStorage();
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

  const clearSecureStorage = async () => {
    await SecureStore.deleteItemAsync(SECURE_AUTH_KEY);
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    setHasSavedCredentials(false);
  };

  const handleLogin = async (email: string, pass: string, saveSecurely: boolean = true) => {
    setIsLoading(true);
    const [error, response] = await loginEmployee(email, pass);
    setIsLoading(false);

    if (error) {
      showStatus('error', 'Erro no Login', String(error));
      return null;
    }

    if (response) {
      setToken(response.token);
      const fullName = `${response.employee?.first_name || ''} ${response.employee?.last_name || ''}`.trim();
      setEmployeeName(fullName || response.employee?.email || 'Funcionário');
      setEmployeeCustomerId(response.employee?.customer_id || null);
      
      if (saveSecurely) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        if (hasHardware && isEnrolled) {
          // Confirmação Biográfica (Fluxo Seguro)
          const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Confirme sua biometria para ativar o acesso rápido',
            cancelLabel: 'Agora não',
            disableDeviceFallback: true,
          });

          if (authResult.success) {
            await SecureStore.setItemAsync(SECURE_AUTH_KEY, JSON.stringify({ email, pass, timestamp: Date.now() }));
            await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
            setHasSavedCredentials(true);
            showStatus('success', 'Biometria Ativada!', 'Seu próximo acesso será via biometria.');
          } else {
            await clearSecureStorage();
          }
        }
      }
    }
    return response;
  };

  const handleLogout = async (forgetMe: boolean = false) => {
    setToken(null);
    setEmployeeName(null);
    setEmployeeCustomerId(null);
    
    // Se o usuário pediu logout explícito, limpamos as credenciais
    await clearSecureStorage();
  };

  const biometricLogin = async (): Promise<boolean> => {
    try {
      const biometricEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      if (biometricEnabled !== 'true') return false;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) return false;

      // Delay técnico para estabilização da UI
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
          const response = await handleLogin(email, pass, false); // false para não pedir biometria de novo
          return !!response;
        }
      }
      return false;
    } catch (e: any) { 
      return false; 
    }
  };

  return (
    <AuthContext.Provider value={{ 
      token, employeeName, employeeCustomerId, login: handleLogin, logout: handleLogout, 
      biometricLogin, hasSavedCredentials, isInitialLoading, isBiometricSupported, biometricDebugInfo 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
