import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HAULES } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Hooks segregados
  const {
    login, biometricLogin, hasSavedCredentials, token,
    isBiometricSupported
  } = useAuth();
  const { showStatus, hideStatus, statusConfig, isLoading: isGlobalLoading } = useUI();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redireciona se já estiver logado
  useEffect(() => {
    if (token) {
      router.replace('/');
    }
  }, [token]);

  // Tenta biometria automático APENAS se o usuário já habilitou biometria anteriormente
  useEffect(() => {
    if (hasSavedCredentials && !token && isBiometricSupported) {
      const timer = setTimeout(() => {
        handleBiometric();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSavedCredentials, isBiometricSupported, token]); // Token incluso pra garantir reatividade correta

  const handleLogin = async () => {
    if (!email || !password) {
      showStatus('warning', 'Dados Incompletos', 'Preencha email e senha.');
      return;
    }

    // O loading é gerenciado pelo AuthContext/UIContext
    const response = await login(email, password, true);
    if (response) {
      showStatus('success', 'Bem-vindo!', 'Login realizado com sucesso.');
    }
  };

  const handleBiometric = async () => {
    try {
      const success = await biometricLogin();
      if (success) {
        showStatus('success', 'Bem-vindo!', 'Autenticação biométrica concluída.');
      }
    } catch (err) {
      showStatus('error', 'Falha Biometria', 'Ocorreu um erro ao tentar usar a biometria.');
    }
  };

  const getStatusIcon = (type: string) => {
    switch(type) {
      case 'success': return <Ionicons name="checkmark-circle" size={80} color={HAULES.success} />;
      case 'error': return <Ionicons name="close-circle" size={80} color={HAULES.error} />;
      case 'warning': return <Ionicons name="warning" size={80} color={HAULES.warning} />;
      default: return <Ionicons name="information-circle" size={80} color={HAULES.orange} />;
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
          <Image
            source={require('../assets/images/haules-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            tintColor="#FFFFFF"
          />
          <Text style={styles.subtitle}>Acesse sua conta para começar</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={HAULES.textPrimary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={HAULES.textMuted}
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
              <Ionicons name="lock-closed-outline" size={20} color={HAULES.textPrimary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Sua senha"
                placeholderTextColor={HAULES.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={HAULES.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isGlobalLoading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={isGlobalLoading}
          >
            {isGlobalLoading ? (
              <ActivityIndicator color={HAULES.bg} />
            ) : (
              <Text style={styles.loginButtonText}>Entrar no Sistema</Text>
            )}
          </TouchableOpacity>

          {hasSavedCredentials && isBiometricSupported && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometric}
              disabled={isGlobalLoading}
            >
              <Ionicons name="finger-print" size={24} color={HAULES.orange} />
              <Text style={styles.biometricButtonText}>Usar Biometria</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>v1.0.0 • Bar do Haules</Text>
        </View>
      </ScrollView>

      {/* Overlay de Status Global (Sucesso, Erro, Warning) */}
      {(statusConfig.visible || isGlobalLoading) && (
        <View style={styles.globalLoadingOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={statusConfig.visible ? hideStatus : undefined} />
          <View style={styles.statusBox}>
            {isGlobalLoading ? (
              <>
                <ActivityIndicator size="large" color={HAULES.orange} />
                <Text style={styles.statusText}>Autenticando...</Text>
                <Text style={styles.statusSubText}>Validando suas credenciais</Text>
              </>
            ) : (
              <>
                {getStatusIcon(statusConfig.type)}
                <Text style={styles.statusText}>{statusConfig.title}</Text>
                <Text style={styles.statusSubText}>{statusConfig.message}</Text>
                {(statusConfig.type === 'error' || statusConfig.type === 'warning') && (
                  <TouchableOpacity style={[styles.confirmButtonLarge, {width: '100%', marginTop: 20}]} onPress={hideStatus}>
                    <Text style={styles.confirmButtonText}>Ok</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HAULES.bg },
  scrollContent: { flexGrow: 1, paddingHorizontal: 30, justifyContent: 'center' },
  headerArea: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 160, height: 80, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: HAULES.orange },
  subtitle: { fontSize: 16, color: HAULES.textSecondary, marginTop: 5 },
  formCard: { backgroundColor: HAULES.bgSurface, borderRadius: 20, padding: 25, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, borderWidth: 1, borderColor: HAULES.border },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: HAULES.textSecondary, marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: HAULES.bgInput, borderRadius: 12, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: HAULES.border },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: HAULES.textPrimary },
  loginButton: { backgroundColor: HAULES.orange, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 2 },
  disabledButton: { backgroundColor: HAULES.orangeMuted },
  loginButtonText: { color: HAULES.bg, fontSize: 18, fontWeight: 'bold' },
  biometricButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, padding: 10 },
  biometricButtonText: { color: HAULES.orange, fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  footer: { marginTop: 40, alignItems: 'center' },
  versionText: { fontSize: 12, color: HAULES.textMuted },
  globalLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  statusBox: { backgroundColor: HAULES.bgSurface, padding: 30, borderRadius: 24, alignItems: 'center', width: '85%', elevation: 10 },
  statusText: { fontSize: 18, fontWeight: 'bold', marginTop: 15, color: HAULES.textPrimary },
  statusSubText: { fontSize: 14, color: HAULES.textSecondary, marginTop: 8, textAlign: 'center' },
  confirmButtonLarge: { backgroundColor: HAULES.orange, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: HAULES.bg, fontSize: 16, fontWeight: 'bold' },
});
