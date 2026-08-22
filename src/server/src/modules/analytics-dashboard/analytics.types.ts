export interface SalesMetrics {
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
  growthRate: number;
  periodDays: number;
}

export interface CategoryBreakdown {
  category: string;
  revenue: number;
  order_count: number;
  units_sold: number;
}

export interface RevenueTimeSeries {
  date: string;
  revenue: number;
  order_count: number;
}

export interface DashboardSummary {
  sales: SalesMetrics;
  categories: CategoryBreakdown[];
  timeSeries: RevenueTimeSeries[];
  generatedAt: string;
}
