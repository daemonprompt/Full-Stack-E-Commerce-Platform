import {
  Controller, Get, Param, Query, UseGuards, ParseUUIDPipe,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RecommendationsService } from './recommendations.service';
import { RecommendationStrategy } from './recommendations.types';

@Controller('api/v1/recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  @Get('for-you')
  getPersonalized(
    @CurrentUser('id') userId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('strategy') strategy: RecommendationStrategy = 'collaborative',
  ) {
    return this.svc.getPersonalized(userId, Math.min(limit, 50), strategy);
  }

  @Get('bestsellers')
  getBestsellers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.svc.getBestsellers(Math.min(limit, 50));
  }

  @Get('related/:productId')
  getRelated(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit: number,
  ) {
    return this.svc.getRelated(productId, Math.min(limit, 20));
  }
}
