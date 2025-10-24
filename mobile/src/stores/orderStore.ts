import { create } from "zustand";
import database from "../database";
import Order from "../database/models/Order";
import { Q } from "@nozbe/watermelondb";
import SyncService from "../services/syncService";
import { CartItem } from "./cartStore";

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
const syncService = new SyncService("http://localhost:3000"); // TODO: Get from config

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,
  filters: {},

  loadOrders: async (filters = {}) => {
    set({ isLoading: true, error: null });

    try {
      const { status, dateFrom, dateTo, search } = filters;

      // Build query
      let query = database.collections.get<Order>("orders").query();

      // Apply filters
      if (status) {
        query = query.extend(Q.where("status", status));
      }

      if (dateFrom) {
        query = query.extend(Q.where("created_at", Q.gte(dateFrom.getTime())));
      }

      if (dateTo) {
        query = query.extend(Q.where("created_at", Q.lte(dateTo.getTime())));
      }

      if (search) {
        query = query.extend(
          Q.or(
            Q.where("order_number", Q.like(`%${search}%`)),
            Q.where("customer_id", Q.like(`%${search}%`))
          )
        );
      }

      // Sort by creation date (newest first)
      query = query.extend(Q.sortBy("created_at", "desc"));

      const orders = await query.fetch();

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

      let newOrder: Order;

      await database.write(async () => {
        newOrder = await database.collections
          .get<Order>("orders")
          .create((record) => {
            record.orderNumber = orderNumber;
            record.cashierId = "current_user"; // TODO: Get from auth store
            record.customerId = customerId;
            record.orderItems = cartItems;
            record.subtotal = subtotal;
            record.taxAmount = taxAmount;
            record.discountAmount = discountAmount;
            record.total = total;
            record.paymentMethods = paymentMethods;
            record.status = "completed";
            record.customNote = customNote;
            record.syncStatusValue = "pending";
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
      });

      // Reload orders
      await get().loadOrders(get().filters);

      set({ isLoading: false });
      return newOrder!;
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
      await database.write(async () => {
        const order = await database.collections
          .get<Order>("orders")
          .find(orderId);

        await order.update((record) => {
          record.status = status;
          record.syncStatusValue = "pending";
        });

        // Add to sync queue
        await syncService.addToSyncQueue("update", "orders", orderId, {
          status,
        });
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
      const orders = await database.collections
        .get<Order>("orders")
        .query(Q.where("id", orderId))
        .fetch();

      return orders.length > 0 ? orders[0] : null;
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
