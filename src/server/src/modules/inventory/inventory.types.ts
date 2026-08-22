export type AdjustmentReason =
  | 'sale'
  | 'restock'
  | 'return'
  | 'adjustment'
  | 'write-off'
  | 'transfer';

export interface StockAdjustment {
  productId: string;
  productName: string;
  previousQuantity: number;
  newQuantity: number;
  delta: number;
  reason: AdjustmentReason;
  referenceId?: string;
  adjustedAt: string;
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  reorderPoint: number;
  deficit: number;
  category: string;
}

export interface InventorySnapshot {
  snapshotAt: string;
  trackedProducts: number;
  totalUnits: number;
  totalValue: number;
  outOfStock: number;
  lowStock: number;
}
