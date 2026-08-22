import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InventoryService } from './inventory.service';
import { AdjustStockDto, BulkRestockDto } from './inventory.dto';

@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'warehouse')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('snapshot')
  getSnapshot() {
    return this.svc.getSnapshot();
  }

  @Get('low-stock')
  getLowStock(
    @Query('threshold', new DefaultValuePipe(undefined), ParseIntPipe) threshold?: number,
  ) {
    return this.svc.getLowStockAlerts(threshold);
  }

  @Patch('products/:id/stock')
  @Roles('admin', 'warehouse', 'ops')
  adjustStock(
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.svc.adjustStock(productId, dto.delta, dto.reason, dto.referenceId);
  }

  @Post('restock/bulk')
  @Roles('admin', 'warehouse')
  bulkRestock(@Body() dto: BulkRestockDto) {
    return this.svc.bulkRestock(dto.updates);
  }
}
