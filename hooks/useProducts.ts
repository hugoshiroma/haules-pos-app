import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useCallback } from "react";
import { medusaAdmin } from "../lib/medusa";

// TODO: Instalar a dependência: yarn add @react-native-async-storage/async-storage

const CACHE_KEY = "cached-products";
const CACHE_TIMESTAMP_KEY = "cached-products-timestamp";
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

// Definindo um tipo mais simples para o produto, para facilitar
export type Product = {
  id: string;
  title: string;
  thumbnail: string | null;
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
  console.log("Buscando todas as variantes com preços da API Medusa (Admin)...");
  const variantsResult = await medusaAdmin.admin.productVariant.list();

  console.log("Buscando a lista de produtos da API Medusa (Store)...");
  const productsResult = await medusaAdmin.store.product.list();

  console.log("Mapeando produtos e preços...");
  const simplifiedProducts: Product[] = productsResult.products.map(
    (product) => ({
      id: product.id,
      title: product.title,
      thumbnail: product.thumbnail,
      variants: product.variants.map((variant) => {
        // Find the corresponding variant from the admin variantsResult to get its prices
        const fullVariant = variantsResult.variants.find(
          (v) => v.id === variant.id,
        );
        return {
          id: variant.id,
          title: variant.title,
          prices:
            fullVariant?.prices?.map((price) => ({
              ...price,
              amount: price.amount * 100,
            })) || [],
        };
      }),
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