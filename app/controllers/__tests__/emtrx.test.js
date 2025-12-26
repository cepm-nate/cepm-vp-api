// Unit tests for Emtrx controller

let mockPool;

const mockAllSettled = jest.fn();
jest.mock('promise', () => ({
 allSettled: mockAllSettled,
 resolve: jest.fn(),
 reject: jest.fn(),
 all: jest.fn(),
}));

const mockExecute = jest.fn();
const mockQuery = jest.fn();

jest.mock('../../connectors/db', () => {
 mockPool = {
   request: jest.fn().mockImplementation(() => ({
     input: jest.fn().mockReturnThis(),
     output: jest.fn().mockReturnThis(),
     execute: mockExecute,
     query: mockQuery,
   })),
 };

 return {
   sql: require('mssql'),
   poolPromise: Promise.resolve(mockPool),
 };
});

const Emtrx = require('../emtrx');

describe('Emtrx Controller', () => {
  let emtrx;

  beforeEach(() => {
    emtrx = new Emtrx();
    // Clear mock calls before each test
    jest.clearAllMocks();
    // Set default mock resolves
    mockExecute.mockResolvedValue({ recordset: [], output: {} });
    mockQuery.mockResolvedValue({ recordset: [{ ctnum: 123 }] });
  });

  describe('dateFormat', () => {
    it('should format date correctly', () => {
      const dateStr = '2023-10-01T12:00:00.000Z';
      const fmt = 'yyyy-MM-dd';
      const result = emtrx.dateFormat(dateStr, fmt);
      expect(result).toBe('2023-10-01');
    });

    it('should return null for invalid date', () => {
      const result = emtrx.dateFormat('invalid', 'yyyy-MM-dd');
      expect(result).toBeNull();
    });
  });

  describe('dateFromDb', () => {
    it('should parse date string correctly', () => {
      const dateStr = '2023-10-01T12:00:00.000Z';
      const result = emtrx.dateFromDb(dateStr);
      expect(result).toBeInstanceOf(Date);
    });

    it('should return date if already date', () => {
      const date = new Date();
      const result = emtrx.dateFromDb(date);
      expect(result).toBe(date);
    });
  });

  describe('findSince', () => {
    it('should query since last_seq and return transfers', async () => {
      const req = { params: { last_seq: '0' } };
      mockExecute.mockResolvedValueOnce({
        recordset: [
          { _id: 'emtrx-1', LocationHistoryId: '1', PartNo: null, DELETED: 0, Equipment: 'EQ1' },
        ],
      });

      const result = await emtrx.findSince(req);

      expect(result.Transfers).toEqual([{ _id: 'emtrx-1', DELETED: 0, Equipment: 'EQ1' }]);
      expect(result.LAST_SEQ).toBe(123);
      expect(result.ExecutionTime).toBeGreaterThanOrEqual(0);
    });

    // Add more tests for edge cases, like empty recordset
  });

  describe('findSingle', () => {
    it('should query single id and return transfers', async () => {
      const req = { params: { id: 'emtrx-1' } };
      mockExecute.mockResolvedValueOnce({
        recordset: [
          { _id: 'emtrx-1', LocationHistoryId: '1', PartNo: null, DELETED: 0 },
        ],
      });

      const result = await emtrx.findSingle(req);

      expect(result.Transfers).toEqual([{ _id: 'emtrx-1', DELETED: 0 }]);
      expect(result.Sent._id).toBe('emtrx-1');
      expect(result.ExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('save', () => {
    it('should upsert updates and return composed result', async () => {
      const req = {
        body: {
          updated: [{ _id: 'emtrx-new', EMCo: 1, Equipment: 'EQ1', Sequence: 1, DateTimeIn: new Date(), CreatedBy: 'test' }],
          deleted: [],
        },
      };

      mockAllSettled.mockResolvedValue({ output: { curChangeNum: 789 } });
      // Mock for upsert
      mockExecute.mockResolvedValueOnce({ output: { curChangeNum: 789 } });
      // Mock for query after save
      mockExecute.mockResolvedValueOnce({
        recordset: [{ _id: 'emtrx-new', EMCo: 1, Equipment: 'EQ1' }],
      });

      const result = await emtrx.save(req);

      expect(result.sent).toBe(req.body);
      expect(result.onServer).toEqual([{ _id: 'emtrx-new', EMCo: 1, Equipment: 'EQ1', PartTransfers: [{ KeyID: undefined, PartNo: undefined, ReceivedBy: undefined, ReceivedMemo: undefined, ReceivedOn: undefined, ShippedBy: undefined, ShippedMemo: undefined, ShippedOn: undefined }] }]);
    });

    // Test with deletes
  });

  describe('findSince', () => {
    it('should handle empty recordset', async () => {
      const req = { params: { last_seq: '0' } };
      mockExecute.mockResolvedValueOnce({ recordset: [], output: {} });

      const result = await emtrx.findSince(req);

      expect(result.Transfers).toEqual([]);
      expect(result.LAST_SEQ).toBe(123);
    });

    it('should throw error if query fails', async () => {
      mockExecute.mockRejectedValue(new Error('DB error'));
      const req = { params: { last_seq: '0' } };

      await expect(emtrx.findSince(req)).rejects.toThrow('DB error');
    });
  });

  describe('findSingle', () => {
    it('should handle empty recordset', async () => {
      const req = { params: { id: 'emtrx-1' } };
      mockExecute.mockResolvedValueOnce({ recordset: [] });

      const result = await emtrx.findSingle(req);

      expect(result.Transfers).toEqual([]);
      expect(result.Sent._id).toBe('emtrx-1');
    });
  });

  describe('save', () => {
    it('should handle deletes only', async () => {
      const req = {
        body: {
          updated: [],
          deleted: ['emtrx-del'],
        },
      };

      mockAllSettled.mockResolvedValue({ output: { curChangeNum: 789 } });
      mockExecute.mockResolvedValueOnce({ output: { curChangeNum: 789 } });
      mockExecute.mockResolvedValueOnce({
        recordset: [{ _id: null, DELETED: 1, LocationHistoryId: 'del', PartNo: undefined }],
      });

      const result = await emtrx.save(req);

      expect(result.onServer).toEqual([{ _id: 'emtrx-del', DELETED: 1, PartTransfers: [{ KeyID: undefined, PartNo: undefined, ReceivedBy: undefined, ReceivedMemo: undefined, ReceivedOn: undefined, ShippedBy: undefined, ShippedMemo: undefined, ShippedOn: undefined }] }]);
    });
  });

  describe('_transformIntoRows', () => {
    it('should transform rows with PartTransfers', async () => {
      const rows = {
        recordset: [
          { _id: 'emtrx-1', LocationHistoryId: '1', PartNo: 'P1', ReceivedBy: 'User', ReceivedOn: '2023-01-01', ShippedBy: 'Shipper', ShippedOn: '2023-01-02', KeyID: 123, DELETED: 0 },
          { _id: 'emtrx-1', LocationHistoryId: '1', PartNo: 'P2', ReceivedBy: 'User2', DELETED: 0 },
        ],
      };

      const result = await emtrx._transformIntoRows(rows);

      expect(result.length).toBe(1);
      expect(result[0]._id).toBe('emtrx-1');
      expect(result[0].PartTransfers).toHaveLength(2);
    });

    it('should generate _id for DELETED rows', async () => {
      const rows = {
        recordset: [
          { LocationHistoryId: '1', PartNo: null, DELETED: 1 },
        ],
      };

      const result = await emtrx._transformIntoRows(rows);

      expect(result.length).toBe(1);
      expect(result[0]._id).toBe('emtrx-1');
    });
  });

  describe('_querySince', () => {
    it('should execute query with last_seq', async () => {
      await emtrx._querySince('100');

      expect(mockExecute).toHaveBeenCalled();
      // Check inputs
    });
  });

  describe('_querySingle', () => {
    it('should execute query for single id', async () => {
      await emtrx._querySingle('emtrx-1');

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('_getChangeTrackingCurrentVersion', () => {
    it('should return current version', async () => {
      const result = await emtrx._getChangeTrackingCurrentVersion();

      expect(result).toBe(123);
    });
  });

  describe('_composeResult', () => {
    it('should compose result with sent and onServer', () => {
      const freshSaved = [{ _id: 'emtrx-1' }];
      const body = { updated: [{}] };

      const result = emtrx._composeResult(freshSaved, body);

      expect(result.sent).toBe(body);
      expect(result.onServer).toBe(freshSaved);
    });
  });

  describe('_genFakeTrx', () => {
    it('should generate fake transaction object', () => {
      const result = emtrx._genFakeTrx();

      expect(result.Category).toBe('T-FAKE99');
      expect(result.Equipment).toBe('fakeEQ99');
    });
  });
});