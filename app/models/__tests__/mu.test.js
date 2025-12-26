const MU = require('../mu');

// Mock the MssqlConnection and child_process
jest.mock('db/mssql', () => jest.fn());
jest.mock('child_process');

const MssqlConnection = require('db/mssql');
const { spawn } = require('child_process');

describe('MU Class', () => {
  let mu;
  let mockDb;
  let mockRequest;

  beforeEach(() => {
    // Create mock instance
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      output: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    mockDb = {
      connect: jest.fn().mockResolvedValue(),
      request: jest.fn().mockResolvedValue(mockRequest),
    };

    MssqlConnection.mockReturnValue(mockDb);

    // Mock child_process spawn
    spawn.mockReturnValue({
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
    });

    mu = new MU();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(mu.USER_DOMAIN).toBe('CORP\\');
    });
  });

  describe('connect', () => {
    test('should connect with decoded username and password', async () => {
      const data = {
        VPUserName: 'test%20user',
        Password: 'pass',
        isBeta: true,
      };

      await mu.connect(data);

      expect(mu.db.connect).toHaveBeenCalledWith('test user', 'pass', true);
    });

    test('should use PASSWORD if Password not present', async () => {
      const data = {
        VPUserName: 'user',
        PASSWORD: 'pwd',
        isBeta: false,
      };

      await mu.connect(data);

      expect(mu.db.connect).toHaveBeenCalledWith('user', 'pwd', false);
    });
  });

  describe('post', () => {
    test('should return error if no data sent', async () => {
      const result = await mu.post();
      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    test('should return error for invalid JSON', async () => {
      const result = await mu.post('{invalid json');
      expect(result).toEqual({ error: 'Invalid JSON data!', num_code: 304 });
    });

    test('should throw error if key fields missing', async () => {
      const data = { VPUserName: 'user', Password: 'pass' };
      await expect(mu.post(data)).rejects.toThrow('"co" is not present or undefined.');
    });

    test('should save and post on success', async () => {
      const data = {
        co: '001',
        mth: '01',
        batchId: 'batch1',
        VPUserName: 'user',
        Password: 'pass',
        source: 'src',
        job: 'job1',
        udMemo: 'memo',
        actualDate: '2023-01-01',
        cols: ['col1', 'col2'],
        rows: [['val1', 'val2']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 0, ReturnMessage: 'Success,123' },
        recordset: [],
      });

      const result = await mu.post(data);

      expect(mockRequest.input).toHaveBeenCalledWith('originalUser', 'user');
      expect(mockRequest.execute).toHaveBeenCalledWith('mmspSyncInMatUseBatch');
      expect(result).toEqual({ Message: 'Success', Exploded: ['Success', '123'] });
    });

    test('should throw error on save failure', async () => {
      const data = {
        co: '001',
        mth: '01',
        batchId: 'batch1',
        VPUserName: 'user',
        Password: 'pass',
        cols: ['col1'],
        rows: [['val']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 1, ReturnMessage: 'Error occurred' },
      });

      await expect(mu.post(data)).rejects.toThrow('Error occurred');
    });
  });

  describe('check_key_fields_mu', () => {
    test('should throw error for missing co', () => {
      expect(() => mu.check_key_fields_mu({ mth: '01', batchId: '1' })).toThrow('"co" is not present or undefined.');
    });

    test('should throw error for missing mth', () => {
      expect(() => mu.check_key_fields_mu({ co: '001', batchId: '1' })).toThrow('"mth" is not present or undefined.');
    });

    test('should throw error for missing batchId', () => {
      expect(() => mu.check_key_fields_mu({ co: '001', mth: '01' })).toThrow('"batchId" is not present or undefined.');
    });

    test('should pass with all fields present', () => {
      expect(() => mu.check_key_fields_mu({ co: '001', mth: '01', batchId: '1' })).not.toThrow();
    });
  });

  describe('save_mu_to_db', () => {
    test('should save data to db successfully', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        co: '001',
        mth: '01',
        batchId: 'batch1',
        source: 'src',
        job: 'job1',
        udMemo: 'memo',
        actualDate: '2023-01-01',
        cols: ['col1', 'col2'],
        rows: [['val1', 'val2'], ['val3', 'val4']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 0, ReturnMessage: 'Success' },
        recordset: [],
      });

      const result = await mu.save_mu_to_db(data);

      expect(mu.db.request).toHaveBeenCalled();
      expect(result).toBe('Success');
      expect(mockRequest.input).toHaveBeenCalledWith('originalUser', 'user');
      expect(mockRequest.input).toHaveBeenCalledWith('cols', 'col1,col2');
      expect(mockRequest.input).toHaveBeenCalledWith('rows', 'val1\tval2\rval3\tval4');
      expect(mockRequest.output).toHaveBeenCalledWith('rcode', 0);
      expect(mockRequest.output).toHaveBeenCalledWith('ReturnMessage', '');
    });

    test('should throw error if rcode is 1', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        co: '001',
        mth: '01',
        batchId: 'batch1',
        cols: ['col'],
        rows: [['val']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 1, ReturnMessage: 'Failure' },
      });

      await expect(mu.save_mu_to_db(data)).rejects.toThrow('Failure');
      expect(mu.db.request).toHaveBeenCalled();
    });
  });

  describe('post_saved_mu_in_db', () => {
    test('should return success message if sync out msg includes Success', async () => {
      const sync_out_msg = 'Success,123';
      const data = { Password: 'pass', VPUserName: 'user', co: '001', mth: '01' };

      const result = await mu.post_saved_mu_in_db(sync_out_msg, data);

      expect(result).toEqual({ Message: 'Success', Exploded: ['Success', '123'] });
    });

    test('should handle spawn for posting (simulated)', () => {
      const sync_out_msg = 'Success,123';
      const data = { Password: 'pass', VPUserName: 'user', co: '001', mth: '01' };

      mu.post_saved_mu_in_db(sync_out_msg, data);

      // Since spawn is mocked, just check it was called or not called
      // In the code, spawn is commented out, so perhaps not called
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('array_2d_to_str', () => {
    test('should convert 2d array to string with separators', () => {
      const arr = [['a', 'b'], ['c', 'd']];
      const result = mu.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('a\tb\rc\td');
    });

    test('should handle single row', () => {
      const arr = [['x', 'y']];
      const result = mu.array_2d_to_str(arr, ',', '\n');
      expect(result).toBe('x,y');
    });

    test('should handle empty array', () => {
      const arr = [];
      const result = mu.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('');
    });
  });
});