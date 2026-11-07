import { OverviewQueryDto } from '../../../src/modules/dashboard/dto/overview-query.dto';

describe('OverviewQueryDto getNormalized', () => {
  it('should default periodType to year if not specified', () => {
    const dto = new OverviewQueryDto();
    dto.year = '2026';

    const normalized = dto.getNormalized();
    expect(normalized.periodType).toBe('year');
    expect(normalized.periodValue).toBeUndefined();
    expect(normalized.year).toBe('2026');
  });

  it('should default periodValue to current month if periodType is month and periodValue is missing', () => {
    const dto = new OverviewQueryDto();
    dto.year = '2026';
    dto.periodType = 'month';

    const normalized = dto.getNormalized();
    const currentMonth = (new Date().getMonth() + 1).toString();
    expect(normalized.periodType).toBe('month');
    expect(normalized.periodValue).toBe(currentMonth);
  });

  it('should default periodValue to current quarter if periodType is quarter and periodValue is missing', () => {
    const dto = new OverviewQueryDto();
    dto.year = '2026';
    dto.periodType = 'quarter';

    const normalized = dto.getNormalized();
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3).toString();
    expect(normalized.periodType).toBe('quarter');
    expect(normalized.periodValue).toBe(currentQuarter);
  });

  it('should default periodValue to current week if periodType is week and periodValue is missing', () => {
    const dto = new OverviewQueryDto();
    dto.year = '2026';
    dto.periodType = 'week';

    const normalized = dto.getNormalized();
    expect(normalized.periodType).toBe('week');
    expect(normalized.periodValue).toBeDefined();
    const weekVal = parseInt(normalized.periodValue!, 10);
    expect(weekVal).toBeGreaterThanOrEqual(1);
    expect(weekVal).toBeLessThanOrEqual(53);
  });
});
