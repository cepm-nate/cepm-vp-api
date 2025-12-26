const JobPhase = require('../jobPhase');

jest.mock('../../db/mssql');

const MssqlConnection = require('../../db/mssql');

describe('JobPhase', () => {
  let jobPhase;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      connect: jest.fn(),
      request: jest.fn(),
    };
    MssqlConnection.mockImplementation(() => mockDb);
    jobPhase = new JobPhase();
  });

  describe('constructor', () => {
    it('should set USER_DOMAIN and create db instance', () => {
      expect(jobPhase.USER_DOMAIN).toBe('CORP\\');
      expect(jobPhase.db).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should call db.connect with correct params', async () => {
      const data = {
        Password: 'pass',
        VPUserName: 'user%40domain',
        isBeta: true
      };
      await jobPhase.connect(data);
      expect(mockDb.connect).toHaveBeenCalledWith('user@domain', 'pass', true);
    });

    it('should handle PASSWORD instead of Password', async () => {
      const data = {
        PASSWORD: 'pass',
        VPUserName: 'user',
        isBeta: false
      };
      await jobPhase.connect(data);
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
      const result = await jobPhase.post('');
      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    it('should return error for invalid JSON', async () => {
      const result = await jobPhase.post('{invalid}');
      expect(result).toEqual({ error: 'Invalid JSON data!', num_code: 304 });
    });

    it('should process valid data', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        Notes: 'notes',
        JCJPCols: ['col1', 'col2'],
        JCJPRows: [['a', 'b'], ['c', 'd']],
        JCCHCols: ['col3'],
        JCCHRows: [['e']]
      };
      const result = await jobPhase.post(data);
      expect(result.Message).toBe('Success');
      expect(mockDb.connect).toHaveBeenCalledTimes(2); // once in post, once in save
    });

    it('should handle data as string', async () => {
      const data = JSON.stringify({
        VPUserName: 'user',
        Password: 'pass',
        Notes: 'notes',
        JCJPCols: ['col1'],
        JCJPRows: [['a']],
        JCCHCols: ['col2'],
        JCCHRows: [['b']]
      });
      const result = await jobPhase.post(data);
      expect(result.Message).toBe('Success');
    });
  });

  describe('check_key_fields_jp', () => {
    it('should do nothing (no checks)', () => {
      const data = {};
      expect(() => jobPhase.check_key_fields_jp(data)).not.toThrow();
    });
  });

  describe('save_jp_to_db', () => {
    it('should execute stored procedure and return success', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        Notes: 'notes',
        JCJPCols: ['col1'],
        JCJPRows: [['a']],
        JCCHCols: ['col2'],
        JCCHRows: [['b']]
      };
      const mockRequest = {
        input: jest.fn(),
        output: jest.fn(),
        execute: jest.fn().mockResolvedValue({
          output: { rcode: 0, ReturnMessage: 'Success' },
          recordset: [{ id: 1 }]
        })
      };
      mockDb.request.mockResolvedValue(mockRequest);

      const result = await jobPhase.save_jp_to_db(data);
      expect(result.Message).toBe('Success');
      expect(result.Changes).toEqual([{ id: 1 }]);
      expect(mockRequest.input).toHaveBeenCalledWith('originalUser', 'user');
      expect(mockRequest.input).toHaveBeenCalledWith('JCJPRows', 'a');
    });

    it('should throw error if rcode is 1', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        Notes: 'notes',
        JCJPCols: ['col1'],
        JCJPRows: [['a']],
        JCCHCols: ['col2'],
        JCCHRows: [['b']]
      };
      const mockRequest = {
        input: jest.fn(),
        output: jest.fn(),
        execute: jest.fn().mockResolvedValue({
          output: { rcode: 1, ReturnMessage: 'Error message' }
        })
      };
      mockDb.request.mockResolvedValue(mockRequest);

      await expect(jobPhase.save_jp_to_db(data)).rejects.toThrow('Error message');
    });
  });

  describe('array_2d_to_str', () => {
    it('should convert 2d array to string with separators', () => {
      const arr = [['a', 'b'], ['c', 'd']];
      const result = jobPhase.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('a\tb\rc\td');
    });

    it('should handle single row', () => {
      const arr = [['x', 'y']];
      const result = jobPhase.array_2d_to_str(arr, ',', '\n');
      expect(result).toBe('x,y');
    });

    it('should handle empty array', () => {
      const arr = [];
      const result = jobPhase.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('');
    });
  });
});