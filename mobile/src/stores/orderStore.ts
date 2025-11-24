import { create } from "zustand";
import * as dbHelpers from "../database/db-helpers";
import { Order } from "../database/types";
import SyncService from "../services/syncService";
import { CartItem } from "./cartStore";
import { API_CONFIG } from "../config/api";

export interface OrderFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  filters: OrderFilters;

  // Actions
  loadOrders: (filters?: OrderFilters) => Promise<void>;
  createOrder: (
    cartItems: CartItem[],
    paymentMethods: any[],
    customerId?: string,
    customNote?: string
  ) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  getOrderById: (orderId: string) => Promise<Order | null>;
  syncOrders: () => Promise<void>;
  setFilters: (filters: OrderFilters) => void;
  clearError: () => void;
}

// Create sync service instance
const syncService = new SyncService(API_CONFIG.BASE_URL);

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,
  filters: {},

  loadOrders: async (filters = {}) => {
    set({ isLoading: true, error: null });

    try {
      const orders = await dbHelpers.getAllOrders(filters);
      set({
        orders,
        isLoading: false,
        filters,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load orders",
        isLoading: false,
      });
    }
  },

  createOrder: async (
    cartItems: CartItem[],
    paymentMethods: any[],
    customerId?: string,
    customNote?: string
  ) => {
    set({ isLoading: true, error: null });

    try {
      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
      const discountAmount = cartItems.reduce(
        (sum, item) => sum + item.discount,
        0
      );
      const taxAmount = cartItems.reduce((sum, item) => {
        const taxableAmount = item.subtotal - item.discount;
        return sum + (taxableAmount * item.tax) / 100;
      }, 0);
      const total = subtotal - discountAmount + taxAmount;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;

      const newOrder = await dbHelpers.createOrder({
        orderNumber,
        cashierId: "current_user", // TODO: Get from auth store
        customerId,
        items: JSON.stringify(cartItems),
        subtotal,
        taxAmount,
        discountAmount,
        total,
        payments: JSON.stringify(paymentMethods),
        status: "completed",
        customNote,
      });

      // Add to sync queue
      await syncService.addToSyncQueue("create", "orders", newOrder.id, {
        orderNumber,
        cashierId: "current_user",
        customerId,
        items: cartItems,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        payments: paymentMethods,
        status: "completed",
        customNote,
      });

      // Reload orders
      await get().loadOrders(get().filters);

      set({ isLoading: false });
      return newOrder;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to create order",
        isLoading: false,
      });
      throw error;
    }
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    set({ isLoading: true, error: null });

    try {
      await dbHelpers.updateOrder(orderId, { status });

      // Add to sync queue
      await syncService.addToSyncQueue("update", "orders", orderId, {
        status,
      });

      // Reload orders
      await get().loadOrders(get().filters);

      set({ isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to update order",
        isLoading: false,
      });
    }
  },

  getOrderById: async (orderId: string) => {
    try {
      return await dbHelpers.getOrderById(orderId);
    } catch (error) {
      console.error("Error getting order:", error);
      return null;
    }
  },

  syncOrders: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await syncService.syncAll();

      if (result.success) {
        // Reload orders after sync
        await get().loadOrders(get().filters);
      } else {
        set({
          error: `Sync failed: ${result.errors.join(", ")}`,
        });
      }

      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Sync failed",
        isLoading: false,
      });
    }
  },

  setFilters: (filters: OrderFilters) => {
    set({ filters });
  },

  clearError: () => {
    set({ error: null });
  },
}));
