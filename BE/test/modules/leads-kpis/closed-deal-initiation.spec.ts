import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  closedDealInitiationFields,
  formatRawClosedDeal,
  normalizeDateOnly,
  parseFlexibleDate,
  pickInitiationDateRaw,
} from '../../../src/modules/leads-kpis/closed-deal-initiation.util';
import {
  SavePriorYearDealsDto,
  UpdateClosedDealDto,
} from '../../../src/modules/leads-kpis/dto/leads-kpis.dto';

describe('closed-deal initiationDate helpers (BE_REQUIREMENT_26_09_26 §3)', () => {
  describe('parseFlexibleDate / normalizeDateOnly', () => {
    it.each([
      ['2026-05-04', '2026-05-04'],
      ['2026/5/4', '2026-05-04'],
      ['2026-05-04T00:00:00.000Z', '2026-05-04'],
      ['04/05/2026', '2026-05-04'], // dd/mm/yyyy
      ['4-5-2026', '2026-05-04'],
      ['04.05.2026', '2026-05-04'],
      [46146, '2026-05-04'], // Excel serial
      ['46146', '2026-05-04'],
      [new Date('2026-05-04T00:00:00.000Z'), '2026-05-04'],
      [{ result: 46146 }, '2026-05-04'], // exceljs formula cell
    ])('parses %p -> %s', (input, expected) => {
      expect(normalizeDateOnly(input)).toBe(expected);
    });

    it.each([undefined, null, '', '   ', 'abc', '31/02/2026', '2026-13-01', 0, -5, 'N/A'])(
      'returns null for %p',
      (input) => {
        expect(parseFlexibleDate(input)).toBeNull();
      },
    );

    it('returns UTC-midnight Date objects', () => {
      expect(parseFlexibleDate('15/01/2025')).toEqual(new Date('2025-01-15T00:00:00.000Z'));
    });
  });

  describe('pickInitiationDateRaw', () => {
    it.each([
      [{ 'Ngày bắt đầu': '2026-01-02' }],
      [{ 'Ngay bat dau': '2026-01-02' }],
      [{ ngayBatDau: '2026-01-02' }],
      [{ initiationDate: '2026-01-02' }],
      [{ initiation_date: '2026-01-02' }],
      [{ ' NGÀY BẮT ĐẦU ': '2026-01-02' }],
    ])('finds the value in %p', (row) => {
      expect(pickInitiationDateRaw(row)).toEqual({ found: true, value: '2026-01-02' });
    });

    it('reports not found when no alias is present', () => {
      expect(pickInitiationDateRaw({ closed_date: '2026-01-02' })).toEqual({
        found: false,
        value: undefined,
      });
    });
  });

  describe('response formatting', () => {
    it('prefers the deal value, then the opportunity value, then null', () => {
      expect(
        closedDealInitiationFields({
          initiationDate: new Date('2026-02-01T00:00:00.000Z'),
          opportunityId: 'o',
          opportunity: { initiationDate: new Date('2026-01-01T00:00:00.000Z') },
        }),
      ).toEqual({ initiationDate: '2026-02-01', opportunityId: 'o' });
      expect(
        closedDealInitiationFields({
          initiationDate: null,
          opportunityId: 'o',
          opportunity: { initiationDate: new Date('2026-01-01T00:00:00.000Z') },
        }),
      ).toEqual({ initiationDate: '2026-01-01', opportunityId: 'o' });
      expect(closedDealInitiationFields({})).toEqual({
        initiationDate: null,
        opportunityId: null,
      });
    });

    it('formatRawClosedDeal keeps other fields and drops the helper relation', () => {
      const closedDate = new Date('2026-06-15T00:00:00.000Z');
      expect(
        formatRawClosedDeal({
          id: 'd',
          closedDate,
          year: 2026,
          week: 24,
          initiationDate: null,
          opportunityId: null,
          opportunity: null,
        }),
      ).toEqual({
        id: 'd',
        closedDate,
        year: 2026,
        week: 24,
        initiationDate: null,
        opportunityId: null,
      });
    });
  });

  describe('DTO validation (global ValidationPipe: whitelist + transform)', () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const run = (metatype: any, value: any) =>
      pipe.transform(value, { type: 'body', metatype });

    it('prior-year deals accept "Ngày bắt đầu" and aliases; invalid values become null', async () => {
      const dto: SavePriorYearDealsDto = await run(SavePriorYearDealsDto, {
        year: 2025,
        deals: [
          { companyName: 'A', size: 'SME', setupFee: 1, closedDate: '2025-03-10', 'Ngày bắt đầu': '15/01/2025' },
          { companyName: 'B', size: 'SME', setupFee: 1, closedDate: '2025-03-10', ngayBatDau: 45672 },
          { companyName: 'C', size: 'SME', setupFee: 1, closedDate: '2025-03-10', initiationDate: '2025-01-15' },
          { companyName: 'D', size: 'SME', setupFee: 1, closedDate: '2025-03-10', 'Ngay bat dau': 'not a date' },
          { companyName: 'E', size: 'SME', setupFee: 1, closedDate: '2025-03-10' },
        ],
      });

      expect(dto.deals.map((d) => d.initiationDate)).toEqual([
        '2025-01-15',
        '2025-01-15',
        '2025-01-15',
        null,
        undefined,
      ]);
      // raw alias keys are stripped by the whitelist
      expect(dto.deals[0]).not.toHaveProperty('Ngày bắt đầu');
    });

    it('PUT closed-deal accepts YYYY-MM-DD, null and "" (clear), and the snake_case alias', async () => {
      expect((await run(UpdateClosedDealDto, { initiationDate: '2026-04-20' })).initiationDate).toBe(
        '2026-04-20',
      );
      expect((await run(UpdateClosedDealDto, { initiationDate: null })).initiationDate).toBeNull();
      expect((await run(UpdateClosedDealDto, { initiationDate: '' })).initiationDate).toBeNull();
      expect((await run(UpdateClosedDealDto, { initiation_date: '2026-04-21' })).initiationDate).toBe(
        '2026-04-21',
      );
      expect((await run(UpdateClosedDealDto, { companyName: 'X' })).initiationDate).toBeUndefined();
    });

    it('PUT closed-deal rejects a malformed initiationDate with 400', async () => {
      await expect(run(UpdateClosedDealDto, { initiationDate: 'yesterday' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
