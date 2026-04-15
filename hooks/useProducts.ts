import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useCallback } from "react";
import { medusaAdmin } from "../lib/medusa";

// TODO: Instalar a dependência: yarn add @react-native-async-storage/async-storage

const CACHE_KEY = "cached-products-v3";
const CACHE_TIMESTAMP_KEY = "cached-products-v3-timestamp";
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

// Definindo um tipo mais simples para o produto, para facilitar
export type Product = {
  id: string;
  title: string;
  thumbnail: string | null;
  collection_id: string | null;
  variants: {
    id: string;
    title: string;
    prices: {
      amount: number;
      currency_code: string;
    }[];
  }[];
};

const fetchProducts = async (): Promise<Product[]> => {
  // Usa admin para ambas as chamadas: garante collection_id e todos os campos
  console.log("Buscando produtos via admin API...");
  const [productsResult, variantsResult] = await Promise.all([
    medusaAdmin.admin.product.list({ limit: 500 }),
    medusaAdmin.admin.productVariant.list({ limit: 500 }),
  ]);

  console.log(`Produtos recebidos: ${productsResult.products.length}, variantes: ${variantsResult.variants.length}`);

  // Monta um Map de variantId → prices para lookup O(1)
  const pricesByVariantId = new Map(
    variantsResult.variants.map((v) => [v.id, v.prices ?? []])
  );

  const simplifiedProducts: Product[] = productsResult.products.map(
    (product) => ({
      id: product.id,
      title: product.title,
      thumbnail: product.thumbnail ?? null,
      collection_id: (product as any).collection_id ?? null,
      variants: (product.variants ?? []).map((variant) => ({
        id: variant.id,
        title: variant.title,
        prices: (pricesByVariantId.get(variant.id) ?? []).map((price) => ({
          amount: price.amount * 100,
          currency_code: price.currency_code,
        })),
      })),
    }),
  );

  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(simplifiedProducts));
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    console.log("Produtos salvos no cache.");
  } catch (err) {
    console.warn("Falha ao salvar cache local dos produtos:", err);
  }

  return simplifiedProducts;
};

const getCachedProducts = async (): Promise<Product[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (!raw || !timestamp) {
      console.log("Nenhum cache de produtos encontrado.");
      return null;
    }

    const parsed = JSON.parse(raw);
    const age = Date.now() - parseInt(timestamp, 10);

    if (age < EIGHT_HOURS) {
      console.log("Cache de produtos válido encontrado.");
      return parsed;
    } else {
      console.log("Cache de produtos expirado.");
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
      return null;
    }
  } catch (err) {
    console.warn("Erro ao acessar o cache de produtos:", err);
    return null;
  }
};

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadProducts = useCallback(async (forceFresh = false) => {
    if (forceFresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    setError(null);
    
    try {
      let data = null;
      if (!forceFresh) {
        data = await getCachedProducts();
      }

      if (data) {
        setProducts(data);
      } else {
        const freshProducts = await fetchProducts();
        setProducts(freshProducts);
      }
    } catch (e: any) {
      console.error("Erro ao carregar produtos:", e);
      setError(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return { products, isLoading, isRefreshing, error, refresh: () => loadProducts(true) };
};