// Unit tests for PhyCnts controller

let mockPool, mockExecute, mockQuery, mockAll;

mockExecute = jest.fn();
mockQuery = jest.fn();

const mockAllResolved = jest.fn();
jest.mock('promise', () => ({
 all: mockAllResolved,
 resolve: jest.fn(),
 reject: jest.fn(),
}));

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
   sql: {
     VarChar: jest.fn(),
     Int: jest.fn(),
     BigInt: jest.fn(),
     Numeric: jest.fn(),
     Table: jest.fn().mockImplementation(() => ({
       columns: { add: jest.fn() },
       rows: { add: jest.fn() },
     })),
   },
   poolPromise: Promise.resolve(mockPool),
 };
});

jest.mock('date-fns', () => ({
  format: jest.fn(),
  parseISO: jest.fn(),
  isValid: jest.fn(),
  addDays: jest.fn(),
  getUnixTime: jest.fn(),
}));

const PhyCnts = require('../phycnts');

describe('PhyCnts Controller', () => {
  let phycnts;

  beforeEach(() => {
    phycnts = new PhyCnts();
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ recordset: [], output: {} });
    mockQuery.mockResolvedValue({ recordset: [{ ctnum: 123 }] });
    mockAllResolved.mockResolvedValue([{ rows: [], output: { ChangeTrackNum: '0' } }, 456]);
    require('date-fns').format.mockImplementation((date, fmt) => 'formatted-date');
    require('date-fns').parseISO.mockImplementation((str) => new Date(str));
    require('date-fns').isValid.mockReturnValue(true);
  });

  describe('dateFormat', () => {
    it('should format date string correctly', () => {
      const dt = '2023-10-01T12:00:00.000Z';
      const fmt = 'yyyy-MM-dd';
      const result = phycnts.dateFormat(dt, fmt);
      expect(result).toBe('formatted-date');
      expect(require('date-fns').parseISO).toHaveBeenCalledWith('2023-10-01T12:00:00.000');
    });

    it('should return null for empty string', () => {
      const result = phycnts.dateFormat('', 'yyyy-MM-dd');
      expect(result).toBeNull();
    });

    it('should return null for invalid date', () => {
      require('date-fns').isValid.mockReturnValue(false);
      const result = phycnts.dateFormat('invalid', 'yyyy-MM-dd');
      expect(result).toBeNull();
    });
  });

  describe('dateFromDb', () => {
    it('should return date if already date object', () => {
      const date = new Date();
      const result = phycnts.dateFromDb(date);
      expect(result).toBe(date);
    });

    it('should parse ISO string without Z', () => {
      const t = '2023-10-01T12:00:00';
      const result = phycnts.dateFromDb(t);
      expect(require('date-fns').parseISO).toHaveBeenCalledWith('2023-10-01T12:00:00');
      expect(result).toBeInstanceOf(Date);
    });

    it('should slice Z from string', () => {
      const t = '2023-10-01T12:00:00Z';
      phycnts.dateFromDb(t);
      expect(require('date-fns').parseISO).toHaveBeenCalledWith('2023-10-01T12:00:00');
    });
  });

  describe('findSince', () => {
    it('should query since and return phyCounts', async () => {
      const req = { params: { last_seq: '0' } };
      mockExecute.mockResolvedValueOnce({
        recordset: [{ _id: '1:2:3:4:5', INCo: 1, UserName: 'user', Loc: 'LOC1', MatlGroup: 10, Material: 'MAT1', DELETED: 0 }],
        output: { ChangeTrackNum: '0' },
      });

      const result = await phycnts.findSince(req);

      expect(result.PhyCounts).toEqual([{ _id: '1:2:3:4:5', DELETED: 0, INCo: 1, UserName: 'user', Loc: 'LOC1', MatlGroup: 10, Material: 'MAT1' }]);
      expect(result.LAST_SEQ).toBe(123);
      expect(result.IsFullLoad).toBe(true);
      expect(result.ExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('save', () => {
    /*
    it('should upsert updates and deletes, then return composed result', async () => {
      const req = {
        body: {
          updated: [{ _id: '1:2:3:4:5', INCo: 1, UserName: 'user', Loc: 'LOC1', MatlGroup: 10, Material: 'MAT1', PhyCnt: 100 }],
          deleted: ['del-id'],
        },
      };
      mockAllResolved.mockResolvedValueOnce([{ output: { curChangeNum: 789 } }]);
      mockExecute.mockResolvedValueOnce({ output: { curChangeNum: 789 } });
      mockExecute.mockResolvedValueOnce({
        recordset: [{ _id: '1:2:3:4:5', INCo: 1 }],
      });

      const result = await phycnts.save(req);

      expect(mockAllResolved).toHaveBeenCalledTimes(2); // For upsert and then query
      expect(result.sent).toBe(req.body);
      expect(result.onServer).toEqual([{ _id: '1:2:3:4:5', INCo: 1 }]);
    });
    */

    /*
    it('should handle updates only', async () => {
      const req = {
        body: {
          updated: [{ _id: '1:2:3:4:5', INCo: 1 }],
          deleted: [],
        },
      };
      mockAllResolved.mockResolvedValueOnce([{ output: { curChangeNum: 789 } }]);
      mockExecute.mockResolvedValueOnce({ output: { curChangeNum: 789 } });
      mockExecute.mockResolvedValueOnce({
        recordset: [{ _id: '1:2:3:4:5' }],
      });

      await phycnts.save(req);

      expect(mockAllResolved).toHaveBeenCalled();
    });
    */
  });

  describe('_querySince', () => {
    it('should execute query for since last_seq', async () => {
      await phycnts._querySince('0');

      expect(mockExecute).toHaveBeenCalledWith('mmspGatherINPhyCountWkSheets');
    });
  });

  describe('_transformIntoRows', () => {
    it('should reject if no recordset', async () => {
      await expect(phycnts._transformIntoRows({})).rejects.toMatchObject({ message: ' - Missing recordset!' });
    });

    it('should return empty array for empty recordset', async () => {
      const result = await phycnts._transformIntoRows({ recordset: [] });

      expect(result).toEqual({ rows: [], output: undefined });
    });

    it('should compact rows and return', async () => {
      const rows = {
        recordset: [
          { _id: '1', DELETED: 0, INCo: 1 },
          { _id: '1', DELETED: 0, INCo: 1 },
        ],
        output: { ChangeTrackNum: '0' },
      };

      const result = await phycnts._transformIntoRows(rows);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]._id).toBe('1');
    });
  });

  describe('_upsertIntoSQL', () => {
    it('should prepare table and execute upsert', async () => {
      const tx = {
        _id: '1:2:3:4:5',
        INCo: 1,
        UserName: 'user',
        Loc: 'LOC1',
        MatlGroup: 10,
        Material: 'MAT1',
        PhyCnt: 100,
      };
      const isDelete = false;

      const result = await phycnts._upsertIntoSQL(tx, isDelete);

      expect(mockExecute).toHaveBeenCalledWith('mmspUpsertINPhyCounts');
    });
  });

  describe('_getChangeTrackingCurrentVersion', () => {
    it('should query and return ctnum', async () => {
      const result = await phycnts._getChangeTrackingCurrentVersion();

      expect(result).toBe(123);
    });
  });

  describe('_composeResult', () => {
    it('should return composed result object', () => {
      const freshSaved = [{ id: 1 }];
      const body = { updated: [] };

      const result = phycnts._composeResult(freshSaved, body);

      expect(result.sent).toBe(body);
      expect(result.onServer).toBe(freshSaved);
    });
  });
});