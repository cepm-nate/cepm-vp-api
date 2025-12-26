const MO = require('../mo');

jest.mock('../../db/mssql');

const MssqlConnection = require('../../db/mssql');

describe('MO', () => {
  let mo;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      connect: jest.fn(),
      request: jest.fn(),
    };
    MssqlConnection.mockImplementation(() => mockDb);
    mo = new MO();
  });

  describe('constructor', () => {
    it('should set USER_DOMAIN and create db instance', () => {
      expect(mo.USER_DOMAIN).toBe('CORP\\');
      expect(mo.db).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should call db.connect with correct params', async () => {
      const data = {
        Password: 'pass',
        VPUserName: 'user%40domain',
        isBeta: true
      };
      await mo.connect(data);
      expect(mockDb.connect).toHaveBeenCalledWith('user@domain', 'pass', true);
    });

    it('should handle PASSWORD instead of Password', async () => {
      const data = {
        PASSWORD: 'pass',
        VPUserName: 'user',
        isBeta: false
      };
      await mo.connect(data);
      expect(mockDb.connect).toHaveBeenCalledWith('user', 'pass', false);
    });
  });

  describe('post', () => {
    beforeEach(() => {
      const mockRequest = {
        input: jest.fn(),
        output: jest.fn(),
        execute: jest.fn().mockResolvedValue({
          output: { rcode: 0, ReturnMessage: 'Success' },
          recordset: []
        })
      };
      mockDb.request.mockResolvedValue(mockRequest);
    });

    it('should return error for no data', async () => {
      const result = await mo.post('');
      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    it('should return error for invalid JSON', async () => {
      const result = await mo.post('{invalid}');
      expect(result).toEqual({ error: 'Invalid JSON data!', num_code: 304 });
    });

    it('should process valid data', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        co: 'company',
        mth: 'month',
        mo: 'mo',
        batchId: 'batch',
        batchSeq: 'seq',
        hdrCols: ['col1', 'col2'],
        hdrRow: ['a', 'b'],
        detCols: ['col3'],
        detRows: [['c']]
      };
      const result = await mo.post(data);
      expect(result).toBe('Success');
      expect(mockDb.connect).toHaveBeenCalledTimes(2);
    });

    it('should handle data as string', async () => {
      const data = JSON.stringify({
        VPUserName: 'user',
        Password: 'pass',
        co: 'co',
        mth: 'mth',
        mo: 'mo',
        batchId: 'batchId',
        batchSeq: 'batchSeq',
        hdrCols: ['hcol'],
        hdrRow: ['hval'],
        detCols: ['dcol'],
        detRows: [['dval']]
      });
      const result = await mo.post(data);
      expect(result).toBe('Success');
    });
  });

  describe('check_key_fields_mo', () => {
    it('should throw if co is missing', () => {
      const data = { mth: '1', mo: '2', batchId: '3', batchSeq: '4' };
      expect(() => mo.check_key_fields_mo(data)).toThrow('"co" is not present or undefined.');
    });

    it('should throw if mth is missing', () => {
      const data = { co: '1', mo: '2', batchId: '3', batchSeq: '4' };
      expect(() => mo.check_key_fields_mo(data)).toThrow('"mth" is not present or undefined.');
    });

    it('should throw if mo is missing', () => {
      const data = { co: '1', mth: '2', batchId: '3', batchSeq: '4' };
      expect(() => mo.check_key_fields_mo(data)).toThrow('"mo" is not present or undefined.');
    });

    it('should throw if batchId is missing', () => {
      const data = { co: '1', mth: '2', mo: '3', batchSeq: '4' };
      expect(() => mo.check_key_fields_mo(data)).toThrow('"batchId" is not present or undefined.');
    });

    it('should throw if batchSeq is missing', () => {
      const data = { co: '1', mth: '2', mo: '3', batchId: '4' };
      expect(() => mo.check_key_fields_mo(data)).toThrow('"batchSeq" is not present or undefined.');
    });

    it('should not throw if all fields are present', () => {
      const data = { co: '1', mth: '2', mo: '3', batchId: '4', batchSeq: '5' };
      expect(() => mo.check_key_fields_mo(data)).not.toThrow();
    });
  });

  describe('save_mo_to_db', () => {
    it('should execute stored procedure and return message', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        co: 'co',
        mth: 'mth',
        mo: 'mo',
        batchId: 'batchId',
        batchSeq: 'batchSeq',
        hdrCols: ['hcol'],
        hdrRow: ['hval'],
        detCols: ['dcol'],
        detRows: [['dval']]
      };
      const mockRequest = {
        input: jest.fn(),
        output: jest.fn(),
        execute: jest.fn().mockResolvedValue({
          output: { rcode: 0, ReturnMessage: 'Processed' },
          recordset: []
        })
      };
      mockDb.request.mockResolvedValue(mockRequest);

      const result = await mo.save_mo_to_db(data);
      expect(result).toBe('Processed');
      expect(mockRequest.input).toHaveBeenCalledWith('co', 'co');
      expect(mockRequest.input).toHaveBeenCalledWith('detRows', 'dval');
    });

    it('should throw error if rcode is 1', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        co: 'co',
        mth: 'mth',
        mo: 'mo',
        batchId: 'batchId',
        batchSeq: 'batchSeq',
        hdrCols: ['hcol'],
        hdrRow: ['hval'],
        detCols: ['dcol'],
        detRows: [['dval']]
      };
      const mockRequest = {
        input: jest.fn(),
        output: jest.fn(),
        execute: jest.fn().mockResolvedValue({
          output: { rcode: 1, ReturnMessage: 'Error' }
        })
      };
      mockDb.request.mockResolvedValue(mockRequest);

      await expect(mo.save_mo_to_db(data)).rejects.toThrow('Error');
    });
  });

  describe('array_2d_to_str', () => {
    it('should convert 2d array to string with separators', () => {
      const arr = [['a', 'b'], ['c', 'd']];
      const result = mo.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('a\tb\rc\td');
    });

    it('should handle single row', () => {
      const arr = [['x', 'y']];
      const result = mo.array_2d_to_str(arr, ',', '\n');
      expect(result).toBe('x,y');
    });

    it('should handle empty array', () => {
      const arr = [];
      const result = mo.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('');
    });
  });
});