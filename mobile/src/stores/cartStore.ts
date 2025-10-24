import { create } from 'zustand';

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  
  // Actions
  addItem: (product: any, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateDiscount: (productId: string, discount: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getItemById: (productId: string) => CartItem | undefined;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  taxAmount: 0,
  discountAmount: 0,
  total: 0,

  addItem: (product: any, quantity = 1) => {
    const { items } = get();
    const existingItem = items.find(item => item.productId === product.id);
    
    if (existingItem) {
      // Update existing item quantity
      get().updateQuantity(product.id, existingItem.quantity + quantity);
    } else {
      // Add new item
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity,
        unitPrice: product.price,
        discount: 0,
        tax: product.taxRate || 0,
        subtotal: product.price * quantity,
      };
      
      set(state => {
        const newItems = [...state.items, newItem];
        return {
          items: newItems,
          ...calculateTotals(newItems),
        };
      });
    }
  },

  removeItem: (productId: string) => {
    set(state => {
      const newItems = state.items.filter(item => item.productId !== productId);
      return {
        items: newItems,
        ...calculateTotals(newItems),
      };
    });
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    set(state => {
      const newItems = state.items.map(item => {
        if (item.productId === productId) {
          const updatedItem = {
            ...item,
            quantity,
            subtotal: item.unitPrice * quantity,
          };
          return updatedItem;
        }
        return item;
      });
      
      return {
        items: newItems,
        ...calculateTotals(newItems),
      };
    });
  },

  updateDiscount: (productId: string, discount: number) => {
    set(state => {
      const newItems = state.items.map(item => {
        if (item.productId === productId) {
          const updatedItem = {
            ...item,
            discount,
            subtotal: (item.unitPrice * item.quantity) - discount,
          };
          return updatedItem;
        }
        return item;
      });
      
      return {
        items: newItems,
        ...calculateTotals(newItems),
      };
    });
  },

  clearCart: () => {
    set({
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
    });
  },

  getItemCount: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },

  getItemById: (productId: string) => {
    return get().items.find(item => item.productId === productId);
  },
}));

// Helper function to calculate totals
function calculateTotals(items: CartItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = items.reduce((sum, item) => sum + item.discount, 0);
  const taxAmount = items.reduce((sum, item) => {
    const taxableAmount = item.subtotal - item.discount;
    return sum + (taxableAmount * item.tax / 100);
  }, 0);
  const total = subtotal - discountAmount + taxAmount;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
  };
}
