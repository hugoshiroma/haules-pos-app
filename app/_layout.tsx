import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, Image, Dimensions } from 'react-native';
import 'react-native-reanimated';

import { HAULES } from '../constants/Colors';
import { UIProvider } from '../contexts/UIContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { CartProvider } from '../contexts/CartContext';
import { PaymentProvider } from '../contexts/PaymentContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function SplashView() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
      <Image
        source={require('../assets/images/haules-logo-white.png')}
        style={{ width: SCREEN_WIDTH - 80, resizeMode: 'contain' }}
      />
    </View>
  );
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Hide native splash immediately — JS SplashView takes over seamlessly (same black bg)
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return <SplashView />;
  }

  return (
    <UIProvider>
      <AuthProvider>
        <CartProvider>
          <PaymentProvider>
            <RootLayoutNav />
          </PaymentProvider>
        </CartProvider>
      </AuthProvider>
    </UIProvider>
  );
}

function RootLayoutNav() {
  const { token, isInitialLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isInitialLoading) return;

    // TODO: Ajustar lógica de segmentos se necessário
    const inAuthGroup = segments[0] === 'login';

    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [token, isInitialLoading, segments]);

  if (isInitialLoading) {
    return <SplashView />;
  }

  const HaulesTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: HAULES.orange,
      background: HAULES.bg,
      card: HAULES.bgSurface,
      text: HAULES.textPrimary,
      border: HAULES.border,
    },
  };

  return (
    <ThemeProvider value={HaulesTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: true }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
