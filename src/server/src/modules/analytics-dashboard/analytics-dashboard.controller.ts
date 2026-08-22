import {
  Controller, Get, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsDashboardService } from './analytics-dashboard.service';

@Controller('api/v1/analytics/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'analytics')
export class AnalyticsDashboardController {
  constructor(private readonly svc: AnalyticsDashboardService) {}

  @Get('summary')
  getSummary(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.svc.getSummary(Math.min(days, 365));
  }

  @Get('sales')
  getSalesMetrics(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.svc.getSalesMetrics(Math.min(days, 365));
  }

  @Get('categories')
  getCategoryBreakdown(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.svc.getCategoryBreakdown(Math.min(days, 365));
  }

  @Get('revenue-series')
  getRevenueSeries(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.svc.getRevenueTimeSeries(Math.min(days, 365));
  }
}
