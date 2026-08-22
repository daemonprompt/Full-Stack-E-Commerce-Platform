import { Product } from '../products/product.entity';

export type RecommendationStrategy = 'collaborative' | 'bestseller' | 'related';

export interface RecommendationResult {
  product: Product;
  score: number;
  reason: 'customers_also_bought' | 'bestseller' | 'related';
}
