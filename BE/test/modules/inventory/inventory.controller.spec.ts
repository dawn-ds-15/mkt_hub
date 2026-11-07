import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from '../../../src/modules/inventory/inventory.controller';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { UpdateBatchDto } from '../../../src/modules/inventory/dto/inventory.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('InventoryController - Validation & Recalculate Scope (Requirement 3.4 & 9)', () => {
  let controller: InventoryController;
  let service: any;
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  beforeEach(async () => {
    service = {
      updateBatch: jest.fn().mockResolvedValue({ id: 'batch-1', quantityIn: 250 }),
      recalculateAllBatches: jest.fn().mockResolvedValue({
        message: 'Đã tính lại tồn kho cho 1 lô hàng.',
        updatedCount: 1,
        updatedBatches: [
          { id: 'batch-1', batchCode: 'B001', oldStock: 250, newStock: 68, totalExported: 182, status: 'active' },
        ],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: service },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  describe('3.4 Forbid Non-Whitelisted Properties', () => {
    it('rejects unrecognized field "quantity" with BadRequestException (HTTP 400)', async () => {
      const payload = { quantity: 800 };

      await expect(
        validationPipe.transform(payload, {
          type: 'body',
          metatype: UpdateBatchDto,
        }),
      ).rejects.toThrow(BadRequestException);

      try {
        await validationPipe.transform(payload, {
          type: 'body',
          metatype: UpdateBatchDto,
        });
      } catch (err: any) {
        const res = err.getResponse();
        const messages = Array.isArray(res.message) ? res.message : [res.message];
        expect(messages.some((m: string) => m.includes('quantity'))).toBe(true);
      }
    });

    it('rejects direct modification of "currentStock" with BadRequestException (HTTP 400)', async () => {
      const payload = { currentStock: 68 };

      await expect(
        validationPipe.transform(payload, {
          type: 'body',
          metatype: UpdateBatchDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts valid whitelisted fields like "quantityIn" and "note"', async () => {
      const payload = { quantityIn: 250, note: 'Cập nhật ghi chú' };

      const transformed = await validationPipe.transform(payload, {
        type: 'body',
        metatype: UpdateBatchDto,
      });

      expect(transformed.quantityIn).toBe(250);
      expect(transformed.note).toBe('Cập nhật ghi chú');
    });
  });

  describe('9. Recalculate endpoint with scope and detailed response', () => {
    it('passes itemId and batchId scope to service and returns updatedCount/updatedBatches', async () => {
      const user = { id: 'user-1', email: 'user@test.com' } as any;

      const res = await controller.recalculate(user, 'item-123', undefined, undefined);

      expect(service.recalculateAllBatches).toHaveBeenCalledWith('user-1', {
        itemId: 'item-123',
        batchId: undefined,
      });
      expect(res.updatedCount).toBe(1);
      expect(res.updatedBatches[0].newStock).toBe(68);
    });
  });
});
