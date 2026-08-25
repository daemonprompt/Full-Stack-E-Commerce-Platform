import axios from 'axios';

const ORDERBRIDGE_BASE = process.env.ORDERBRIDGE_URL ?? 'http://orderbridge-internal:8500';
const INTERNAL_SOURCE  = 'techstride-api';

export interface OrderBridgeReserveResult {
  success:   boolean;
  sku?:      string;
  reserved?: number;
  warehouse?: string;
  unit_cost?: number;
  order_ref?: string;
  error?:    string;
  available?: number;
}

export interface OrderBridgeStatusItem {
  sku:           string;
  available:     number;
  warehouse:     string;
  last_reserved: string;
  updated:       string;
}

/**
 * Reserve inventory in the legacy OrderBridge service before confirming
 * payment. OrderBridge owns physical inventory counts for warehouse-fulfilled
 * orders; TechStride's own stock table reflects e-commerce allocation only.
 */
export async function reserveInventory(
  sku:      string,
  quantity: number,
  orderRef: string,
): Promise<OrderBridgeReserveResult> {
  const response = await axios.get<OrderBridgeReserveResult>(
    `${ORDERBRIDGE_BASE}/inventory/reserve.cfm`,
    {
      params:  { sku, quantity, order_ref: orderRef },
      headers: { 'X-Internal-Source': INTERNAL_SOURCE },
      timeout: 5000,
    },
  );
  return response.data;
}

export async function getInventoryStatus(sku: string): Promise<OrderBridgeStatusItem[]> {
  const response = await axios.get<{ items: OrderBridgeStatusItem[]; count: number }>(
    `${ORDERBRIDGE_BASE}/inventory/status.cfm`,
    {
      params:  { sku },
      headers: { 'X-Internal-Source': INTERNAL_SOURCE },
      timeout: 3000,
    },
  );
  return response.data.items ?? [];
}

export async function confirmOrder(
  orderRef:        string,
  sku:             string,
  quantity:        number,
  userId:          string,
  shippingAddress: string,
): Promise<{ success: boolean; order_ref?: string; error?: string }> {
  const response = await axios.post(
    `${ORDERBRIDGE_BASE}/order/confirm.cfm`,
    new URLSearchParams({ order_ref: orderRef, sku, quantity: String(quantity), user_id: userId, shipping_address: shippingAddress }),
    {
      headers: {
        'X-Internal-Source': INTERNAL_SOURCE,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 5000,
    },
  );
  return response.data;
}
