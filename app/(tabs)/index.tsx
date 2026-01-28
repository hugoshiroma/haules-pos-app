import React from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useProducts, Product } from '../../hooks/useProducts';
import { useCart } from '../../contexts/CartContext';
import { useRouter } from 'expo-router';

// --- Header da Tela ---
const Header = () => {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Haules PoS</Text>
      <TouchableOpacity onPress={() => router.push('/scanner')}>
        <Text style={styles.scannerButtonText}>Escanear Cliente</Text>
      </TouchableOpacity>
    </View>
  );
};

// Componente para renderizar cada item da lista de produtos
const ProductCard = ({ item, onAddToCart }: { item: Product, onAddToCart: (item: any) => void }) => {
  const variant = item.variants[0];
  const price = variant?.prices[0];

  if (!variant || !price) {
    return null;
  }
  
  const handlePress = () => {
    onAddToCart({
      id: variant.id,
      product_id: item.id,
      title: item.title,
      price: price.amount / 100,
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.thumbnailContainer}>
        <Image
          style={styles.thumbnail}
          source={{ uri: item.thumbnail || 'https://via.placeholder.com/100' }}
        />
        <Text style={styles.productTitleOverlay} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.productPrice}>
          R$ {(price.amount / 100).toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={handlePress}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

// Componente do footer que mostra o resumo do carrinho
const CartFooter = () => {
  const { items, total, confirmOrder, isLoading } = useCart();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (totalItems === 0) {
    return null;
  }

  return (
    <View style={styles.footer}>
      <View style={styles.footerInfo}>
        <Text style={styles.footerText}>
          {totalItems} {totalItems > 1 ? 'itens' : 'item'}
        </Text>
        <Text style={styles.footerTotal}>
          Total: R$ {total.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]} 
        onPress={confirmOrder}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmButtonText}>Finalizar Compra</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// --- Tela Principal do PoS ---
export default function PosScreen() {
  const { products, isLoading, error } = useProducts();
  const { addItem } = useCart();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Carregando produtos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Erro ao carregar produtos.</Text>
        <Text>{error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <FlatList
        data={products}
        renderItem={({ item }) => <ProductCard item={item} onAddToCart={addItem} />}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
      />
      <CartFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scannerButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  list: {
    padding: 8,
  },
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: '100%',
    height: 100,
    position: 'relative',
    backgroundColor: '#e0e0e0', // Placeholder color
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  productTitleOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: 'black',
    textShadowColor: 'rgba(255, 255, 255, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardInfo: {
    padding: 8,
    flex: 1,
  },
  productPrice: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: 'bold',
  },
  addButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: '#2196F3',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerInfo: {
    flex: 1,
  },
  footerText: {
    fontSize: 16,
  },
  footerTotal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});