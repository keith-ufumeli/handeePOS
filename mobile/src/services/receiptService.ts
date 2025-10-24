import { CartItem } from '../stores/cartStore';
import Order from '../database/models/Order';

export interface ReceiptData {
  orderNumber: string;
  date: string;
  time: string;
  cashier: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethods: {
    method: string;
    amount: number;
    reference?: string;
  }[];
  storeInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

export class ReceiptService {
  /**
   * Generate receipt data from order
   */
  static generateReceiptData(order: Order): ReceiptData {
    const now = new Date();
    
    return {
      orderNumber: order.orderNumber,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      cashier: order.cashierId,
      items: order.orderItems,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      total: order.total,
      paymentMethods: order.paymentMethods,
      storeInfo: {
        name: 'HandeePOS Store',
        address: '123 Main Street, City, State 12345',
        phone: '(555) 123-4567',
        email: 'info@handeepos.com',
      },
    };
  }

  /**
   * Generate receipt text for printing or display
   */
  static generateReceiptText(receiptData: ReceiptData): string {
    const { storeInfo, orderNumber, date, time, cashier, items, subtotal, discountAmount, taxAmount, total, paymentMethods } = receiptData;
    
    let receipt = '';
    
    // Store header
    if (storeInfo) {
      receipt += `${storeInfo.name}\n`;
      receipt += `${storeInfo.address}\n`;
      receipt += `Phone: ${storeInfo.phone}\n`;
      receipt += `Email: ${storeInfo.email}\n`;
      receipt += `${'='.repeat(32)}\n`;
    }
    
    // Order info
    receipt += `Order #: ${orderNumber}\n`;
    receipt += `Date: ${date}\n`;
    receipt += `Time: ${time}\n`;
    receipt += `Cashier: ${cashier}\n`;
    receipt += `${'='.repeat(32)}\n`;
    
    // Items
    receipt += 'ITEMS:\n';
    items.forEach(item => {
      receipt += `${item.productName}\n`;
      receipt += `  ${item.quantity} × $${item.unitPrice.toFixed(2)} = $${item.subtotal.toFixed(2)}\n`;
      if (item.discount > 0) {
        receipt += `  Discount: -$${item.discount.toFixed(2)}\n`;
      }
    });
    
    receipt += `${'='.repeat(32)}\n`;
    
    // Totals
    receipt += `Subtotal: $${subtotal.toFixed(2)}\n`;
    if (discountAmount > 0) {
      receipt += `Discount: -$${discountAmount.toFixed(2)}\n`;
    }
    receipt += `Tax: $${taxAmount.toFixed(2)}\n`;
    receipt += `${'='.repeat(32)}\n`;
    receipt += `TOTAL: $${total.toFixed(2)}\n`;
    
    // Payment methods
    receipt += `${'='.repeat(32)}\n`;
    receipt += 'PAYMENT:\n';
    paymentMethods.forEach(payment => {
      receipt += `${payment.method.toUpperCase()}: $${payment.amount.toFixed(2)}\n`;
      if (payment.reference) {
        receipt += `Ref: ${payment.reference}\n`;
      }
    });
    
    // Footer
    receipt += `${'='.repeat(32)}\n`;
    receipt += 'Thank you for your business!\n';
    receipt += 'Please come again.\n';
    
    return receipt;
  }

  /**
   * Generate receipt HTML for display
   */
  static generateReceiptHTML(receiptData: ReceiptData): string {
    const { storeInfo, orderNumber, date, time, cashier, items, subtotal, discountAmount, taxAmount, total, paymentMethods } = receiptData;
    
    let html = `
      <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px; background: white;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px;">${storeInfo?.name || 'HandeePOS Store'}</h2>
          <p style="margin: 5px 0; font-size: 12px;">${storeInfo?.address || '123 Main Street'}</p>
          <p style="margin: 5px 0; font-size: 12px;">${storeInfo?.phone || '(555) 123-4567'}</p>
        </div>
        
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-bottom: 10px;">
          <p style="margin: 2px 0; font-size: 12px;"><strong>Order #:</strong> ${orderNumber}</p>
          <p style="margin: 2px 0; font-size: 12px;"><strong>Date:</strong> ${date}</p>
          <p style="margin: 2px 0; font-size: 12px;"><strong>Time:</strong> ${time}</p>
          <p style="margin: 2px 0; font-size: 12px;"><strong>Cashier:</strong> ${cashier}</p>
        </div>
        
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-bottom: 10px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px;">ITEMS:</h3>
    `;
    
    items.forEach(item => {
      html += `
        <div style="margin-bottom: 8px;">
          <div style="font-weight: bold; font-size: 12px;">${item.productName}</div>
          <div style="font-size: 11px; color: #666;">${item.quantity} × $${item.unitPrice.toFixed(2)} = $${item.subtotal.toFixed(2)}</div>
          ${item.discount > 0 ? `<div style="font-size: 11px; color: #666;">Discount: -$${item.discount.toFixed(2)}</div>` : ''}
        </div>
      `;
    });
    
    html += `
        </div>
        
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px;">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          ${discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px;">
              <span>Discount:</span>
              <span>-$${discountAmount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px;">
            <span>Tax:</span>
            <span>$${taxAmount.toFixed(2)}</span>
          </div>
          <div style="border-top: 1px solid #000; padding-top: 5px; margin-top: 5px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
              <span>TOTAL:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-bottom: 10px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px;">PAYMENT:</h3>
    `;
    
    paymentMethods.forEach(payment => {
      html += `
        <div style="margin-bottom: 5px;">
          <div style="font-size: 12px; font-weight: bold;">${payment.method.toUpperCase()}: $${payment.amount.toFixed(2)}</div>
          ${payment.reference ? `<div style="font-size: 11px; color: #666;">Ref: ${payment.reference}</div>` : ''}
        </div>
      `;
    });
    
    html += `
        </div>
        
        <div style="border-top: 1px solid #000; padding-top: 10px; text-align: center;">
          <p style="margin: 5px 0; font-size: 12px;">Thank you for your business!</p>
          <p style="margin: 5px 0; font-size: 12px;">Please come again.</p>
        </div>
      </div>
    `;
    
    return html;
  }

  /**
   * Share receipt via native sharing
   */
  static async shareReceipt(receiptData: ReceiptData): Promise<void> {
    const receiptText = this.generateReceiptText(receiptData);
    
    // This would use React Native's Share API
    // For now, we'll just log it
    console.log('Receipt to share:', receiptText);
    
    // TODO: Implement actual sharing functionality
    // import { Share } from 'react-native';
    // await Share.share({
    //   message: receiptText,
    //   title: `Receipt ${receiptData.orderNumber}`,
    // });
  }

  /**
   * Print receipt (if printer is available)
   */
  static async printReceipt(receiptData: ReceiptData): Promise<void> {
    const receiptText = this.generateReceiptText(receiptData);
    
    // This would use a printer service
    // For now, we'll just log it
    console.log('Receipt to print:', receiptText);
    
    // TODO: Implement actual printing functionality
    // This would require a printer service or library
  }
}

export default ReceiptService;
