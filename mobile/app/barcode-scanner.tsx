import React, { useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import BarcodeScanner from '@/src/components/BarcodeScanner';
import { useProductStore } from '@/src/stores/productStore';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { searchProductsByBarcode } = useProductStore();
  const [isScanning, setIsScanning] = useState(true);

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      setIsScanning(false);
      
      // Search for product by barcode
      const products = await searchProductsByBarcode(barcode);
      
      if (products && products.length > 0) {
        // Navigate to product details
        router.push(`/products/${products[0].id}`);
      } else {
        // Show alert for product not found
        Alert.alert(
          'Product Not Found',
          `No product found with barcode: ${barcode}`,
          [
            {
              text: 'Add New Product',
              onPress: () => {
                router.push({
                  pathname: '/products/new',
                  params: { barcode }
                });
              }
            },
            {
              text: 'Try Again',
              onPress: () => setIsScanning(true),
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error searching for product:', error);
      Alert.alert(
        'Error',
        'Failed to search for product. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => setIsScanning(true)
          }
        ]
      );
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <BarcodeScanner
        onBarcodeScanned={handleBarcodeScanned}
        onClose={handleClose}
        title="Scan Product Barcode"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
