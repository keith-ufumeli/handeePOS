import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'products',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'sku', type: 'string', isIndexed: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'category_id', type: 'string', isIndexed: true },
        { name: 'price', type: 'number' },
        { name: 'cost', type: 'number' },
        { name: 'tax_rate', type: 'number' },
        { name: 'stock_quantity', type: 'number' },
        { name: 'low_stock_threshold', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'images', type: 'string', isOptional: true }, // JSON string of image URLs
        { name: 'is_active', type: 'boolean' },
        { name: 'sync_status', type: 'string' }, // 'synced', 'pending', 'failed'
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'server_id', type: 'string', isOptional: true }, // Server-side ID
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'categories',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'sync_status', type: 'string' }, // 'synced', 'pending', 'failed'
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'server_id', type: 'string', isOptional: true }, // Server-side ID
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'order_number', type: 'string', isIndexed: true },
        { name: 'cashier_id', type: 'string' },
        { name: 'customer_id', type: 'string', isOptional: true },
        { name: 'items', type: 'string' }, // JSON string of order items
        { name: 'subtotal', type: 'number' },
        { name: 'tax_amount', type: 'number' },
        { name: 'discount_amount', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'payments', type: 'string' }, // JSON string of payment methods
        { name: 'status', type: 'string' }, // 'pending', 'completed', 'cancelled'
        { name: 'custom_note', type: 'string', isOptional: true },
        { name: 'sync_status', type: 'string' }, // 'synced', 'pending', 'failed'
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'server_id', type: 'string', isOptional: true }, // Server-side ID
        { name: 'created_at', type: 'number' },
        { name: 'completed_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'operation', type: 'string' }, // 'create', 'update', 'delete'
        { name: 'collection', type: 'string' }, // 'products', 'categories', 'orders'
        { name: 'document_id', type: 'string' },
        { name: 'data', type: 'string' }, // JSON string of data to sync
        { name: 'status', type: 'string' }, // 'pending', 'syncing', 'completed', 'failed'
        { name: 'retry_count', type: 'number' },
        { name: 'error_message', type: 'string', isOptional: true },
        { name: 'timestamp', type: 'number' },
      ],
    }),
  ],
});
