import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Product } from '../products/product.entity';
import {
  StockAdjustment, LowStockAlert, InventorySnapshot, AdjustmentReason,
} from './inventory.types';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Adjust stock level for a product. Wraps in a transaction to prevent
   * concurrent writes producing negative stock.
   */
  async adjustStock(
    productId: string,
    delta: number,
    reason: AdjustmentReason,
    referenceId?: string,
  ): Promise<StockAdjustment> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      const product = await em.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) throw new NotFoundException(`Product ${productId} not found`);

      const previous = product.stockQuantity;
      const next = previous + delta;

      if (next < 0) {
        throw new BadRequestException(
          `Insufficient stock: have ${previous}, requested ${Math.abs(delta)}`,
        );
      }

      product.stockQuantity = next;
      product.inStock = next > 0;
      await em.save(product);

      return {
        productId,
        productName: product.name,
        previousQuantity: previous,
        newQuantity: next,
        delta,
        reason,
        referenceId,
        adjustedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Bulk stock update for supplier restock events.
   */
  async bulkRestock(
    updates: Array<{ productId: string; quantity: number; supplierId: string }>,
  ): Promise<StockAdjustment[]> {
    return Promise.all(
      updates.map(u =>
        this.adjustStock(u.productId, u.quantity, 'restock', u.supplierId),
      ),
    );
  }

  /**
   * Return products below their configured reorder point.
   */
  async getLowStockAlerts(threshold?: number): Promise<LowStockAlert[]> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.stock_quantity <= p.reorder_point')
      .andWhere('p.track_inventory = true');

    if (threshold !== undefined) {
      qb.andWhere('p.stock_quantity <= :threshold', { threshold });
    }

    const products = await qb.orderBy('p.stock_quantity', 'ASC').getMany();

    return products.map(p => ({
      productId: p.id,
      productName: p.name,
      currentStock: p.stockQuantity,
      reorderPoint: p.reorderPoint,
      deficit: p.reorderPoint - p.stockQuantity,
      category: p.category,
    }));
  }

  /**
   * Point-in-time inventory snapshot for reporting.
   */
  async getSnapshot(): Promise<InventorySnapshot> {
    const products = await this.productRepo.find({ where: { trackInventory: true } });

    const totalUnits = products.reduce((sum, p) => sum + p.stockQuantity, 0);
    const totalValue = products.reduce((sum, p) => sum + p.stockQuantity * p.cost, 0);
    const outOfStock = products.filter(p => p.stockQuantity === 0).length;
    const lowStock = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.reorderPoint).length;

    return {
      snapshotAt: new Date().toISOString(),
      trackedProducts: products.length,
      totalUnits,
      totalValue,
      outOfStock,
      lowStock,
    };
  }
}
