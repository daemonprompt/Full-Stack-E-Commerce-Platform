import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { Order } from '../orders/order.entity';
import { RecommendationResult, RecommendationStrategy } from './recommendations.types';

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  /**
   * Get personalized product recommendations for a user.
   * Uses collaborative filtering based on shared purchase history.
   */
  async getPersonalized(
    userId: string,
    limit = 10,
    strategy: RecommendationStrategy = 'collaborative',
  ): Promise<RecommendationResult[]> {
    if (strategy === 'collaborative') {
      return this.collaborativeFilter(userId, limit);
    }
    return this.getBestsellers(limit);
  }

  /**
   * Collaborative filtering: products bought by users with similar order history.
   */
  private async collaborativeFilter(
    userId: string,
    limit: number,
  ): Promise<RecommendationResult[]> {
    const userOrders = await this.orderRepo.find({
      where: { userId },
      relations: ['items'],
    });

    const purchasedIds = userOrders.flatMap(o => o.items.map(i => i.productId));

    if (purchasedIds.length === 0) {
      return this.getBestsellers(limit);
    }

    const results = await this.productRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.name', 'p.price', 'p.category', 'p.imageUrl'])
      .addSelect('COUNT(DISTINCT o.user_id)', 'cooccurrence')
      .innerJoin('order_items', 'oi', 'oi.product_id = p.id')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .where(
        'o.user_id IN (SELECT DISTINCT o2.user_id FROM orders o2 INNER JOIN order_items oi2 ON o2.id = oi2.order_id WHERE oi2.product_id IN (:...purchasedIds))',
        { purchasedIds },
      )
      .andWhere('p.id NOT IN (:...purchasedIds)', { purchasedIds })
      .andWhere('p.in_stock = true')
      .groupBy('p.id')
      .orderBy('cooccurrence', 'DESC')
      .limit(limit)
      .getRawAndEntities();

    return results.entities.map((p, i) => ({
      product: p,
      score: parseFloat(results.raw[i]?.cooccurrence ?? '0'),
      reason: 'customers_also_bought',
    }));
  }

  /**
   * Fallback: return top-selling products by order volume.
   */
  async getBestsellers(limit = 10): Promise<RecommendationResult[]> {
    const results = await this.productRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.name', 'p.price', 'p.category', 'p.imageUrl'])
      .addSelect('COUNT(oi.id)', 'orderCount')
      .innerJoin('order_items', 'oi', 'oi.product_id = p.id')
      .where('p.in_stock = true')
      .groupBy('p.id')
      .orderBy('"orderCount"', 'DESC')
      .limit(limit)
      .getRawAndEntities();

    return results.entities.map((p, i) => ({
      product: p,
      score: parseFloat(results.raw[i]?.orderCount ?? '0'),
      reason: 'bestseller',
    }));
  }

  /**
   * Related products: same category, similar price range.
   */
  async getRelated(productId: string, limit = 6): Promise<RecommendationResult[]> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) return [];

    const results = await this.productRepo
      .createQueryBuilder('p')
      .where('p.category = :category', { category: product.category })
      .andWhere('p.id != :id', { id: productId })
      .andWhere('p.price BETWEEN :low AND :high', {
        low: product.price * 0.6,
        high: product.price * 1.4,
      })
      .andWhere('p.in_stock = true')
      .orderBy('p.rating', 'DESC')
      .limit(limit)
      .getMany();

    return results.map(p => ({ product: p, score: p.rating, reason: 'related' }));
  }
}
