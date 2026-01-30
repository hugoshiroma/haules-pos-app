import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Pressable
} from 'react-native';
import { useCart } from '../contexts/CartContext';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, biometricLogin, hasSavedCredentials, showStatus, token, statusConfig, hideStatus, isBiometricSupported } = useCart();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redireciona se já estiver logado
  useEffect(() => {
    if (token) {
      router.replace('/');
    }
  }, [token]);

  // Tenta biometria automático se tiver credenciais
  useEffect(() => {
    if (hasSavedCredentials && !token && isBiometricSupported) {
      handleBiometric();
    }
  }, [hasSavedCredentials, isBiometricSupported]);

  const handleLogin = async () => {
    if (!email || !password) {
      showStatus('warning', 'Dados Incompletos', 'Preencha email e senha.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const response = await login(email, password, true);
      if (response) {
        showStatus('success', 'Bem-vindo!', 'Login realizado com sucesso.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBiometric = async () => {
    setIsLoggingIn(true);
    try {
      const success = await biometricLogin();
      if (success) {
        showStatus('success', 'Bem-vindo!', 'Autenticação biométrica concluída.');
      } else {
        // Se falhou e não houve redirecionamento/status do contexto, avisamos
        // Mas o contexto já vai mostrar Alert se for erro real
      }
    } catch (err) {
      showStatus('error', 'Falha Biometria', 'Ocorreu um erro ao tentar usar a biometria.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getStatusIcon = (type: string) => {
    switch(type) {
      case 'success': return <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />;
      case 'error': return <Ionicons name="close-circle" size={80} color="#f44336" />;
      case 'warning': return <Ionicons name="warning" size={80} color="#ff9800" />;
      default: return <Ionicons name="information-circle" size={80} color="#2196F3" />;
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerArea}>
          <View style={styles.logoContainer}>
            <Ionicons name="storefront" size={60} color="#2196F3" />
          </View>
          <Text style={styles.title}>Haules PoS</Text>
          <Text style={styles.subtitle}>Acesse sua conta para começar</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { flex: 1 }]}
                placeholder="Sua senha"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, isLoggingIn && styles.disabledButton]} 
            onPress={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Entrar no Sistema</Text>
            )}
          </TouchableOpacity>

          {hasSavedCredentials && isBiometricSupported && (
            <TouchableOpacity 
              style={styles.biometricButton} 
              onPress={handleBiometric}
              disabled={isLoggingIn}
            >
              <Ionicons name="finger-print" size={24} color="#2196F3" />
              <Text style={styles.biometricButtonText}>Usar Biometria</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>v1.0.0 • Bar do Haules</Text>
        </View>
      </ScrollView>

      {/* Overlay de Loading Global durante o Login */}
      {isLoggingIn && (
        <View style={styles.globalLoadingOverlay}>
          <View style={styles.statusBox}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.statusText}>Autenticando...</Text>
            <Text style={styles.statusSubText}>Validando suas credenciais</Text>
          </View>
        </View>
      )}

      {/* Overlay de Status Global (Sucesso, Erro, Warning) */}
      <Modal visible={statusConfig.visible} transparent animationType="fade">
        <View style={styles.globalLoadingOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hideStatus} />
          <View style={styles.statusBox}>
            {getStatusIcon(statusConfig.type)}
            <Text style={styles.statusText}>{statusConfig.title}</Text>
            <Text style={styles.statusSubText}>{statusConfig.message}</Text>
            {(statusConfig.type === 'error' || statusConfig.type === 'warning') && (
              <TouchableOpacity style={[styles.confirmButtonLarge, {width: '100%', marginTop: 20}]} onPress={hideStatus}>
                <Text style={styles.confirmButtonText}>Ok</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#fff',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  loginButton: {
    backgroundColor: '#2196F3',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: '#a5d1f3',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 10,
  },
  biometricButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#adb5bd',
  },
  globalLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  statusBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    width: '85%',
    elevation: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#333',
  },
  statusSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  confirmButtonLarge: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
