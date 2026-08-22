import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import {
  SalesMetrics, CategoryBreakdown, RevenueTimeSeries,
  DashboardSummary,
} from './analytics.types';

@Injectable()
export class AnalyticsDashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async getSummary(days = 30): Promise<DashboardSummary> {
    const [sales, categories, timeSeries] = await Promise.all([
      this.getSalesMetrics(days),
      this.getCategoryBreakdown(days),
      this.getRevenueTimeSeries(days),
    ]);
    return { sales, categories, timeSeries, generatedAt: new Date().toISOString() };
  }

  async getSalesMetrics(days: number): Promise<SalesMetrics> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const result = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'COUNT(o.id) as order_count',
        'SUM(o.total_amount) as revenue',
        'AVG(o.total_amount) as avg_order_value',
      ])
      .where('o.created_at >= :since', { since })
      .andWhere('o.status = :status', { status: 'completed' })
      .getRawOne();

    const prev = new Date(since);
    prev.setDate(prev.getDate() - days);

    const prevResult = await this.orderRepo
      .createQueryBuilder('o')
      .select('SUM(o.total_amount) as revenue')
      .where('o.created_at >= :prev AND o.created_at < :since', { prev, since })
      .andWhere('o.status = :status', { status: 'completed' })
      .getRawOne();

    const revenue = parseFloat(result?.revenue ?? '0');
    const prevRevenue = parseFloat(prevResult?.revenue ?? '0');
    const growthRate = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

    return {
      orderCount: parseInt(result?.order_count ?? '0'),
      revenue,
      avgOrderValue: parseFloat(result?.avg_order_value ?? '0'),
      growthRate: Math.round(growthRate * 10) / 10,
      periodDays: days,
    };
  }

  async getCategoryBreakdown(days: number): Promise<CategoryBreakdown[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.productRepo
      .createQueryBuilder('p')
      .select(['p.category as category'])
      .addSelect('SUM(oi.quantity * oi.unit_price)', 'revenue')
      .addSelect('COUNT(DISTINCT o.id)', 'order_count')
      .addSelect('SUM(oi.quantity)', 'units_sold')
      .innerJoin('order_items', 'oi', 'oi.product_id = p.id')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .where('o.created_at >= :since', { since })
      .andWhere('o.status = :status', { status: 'completed' })
      .groupBy('p.category')
      .orderBy('revenue', 'DESC')
      .getRawMany();
  }

  async getRevenueTimeSeries(days: number): Promise<RevenueTimeSeries[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.orderRepo
      .createQueryBuilder('o')
      .select("DATE_TRUNC('day', o.created_at) as date")
      .addSelect('SUM(o.total_amount)', 'revenue')
      .addSelect('COUNT(o.id)', 'order_count')
      .where('o.created_at >= :since', { since })
      .andWhere('o.status = :status', { status: 'completed' })
      .groupBy("DATE_TRUNC('day', o.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();
  }
}
