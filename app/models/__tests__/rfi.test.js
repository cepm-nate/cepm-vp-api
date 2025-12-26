const RFI = require('../rfi');

// Mock the MssqlConnection
jest.mock('db/mssql', () => jest.fn());

const MssqlConnection = require('db/mssql');

describe('RFI Class', () => {
  let rfi;
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

    rfi = new RFI();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(rfi.USER_DOMAIN).toBe('CORP\\');
    });
  });

  describe('connect', () => {
    test('should connect with decoded username and password', async () => {
      const data = {
        VPUserName: 'test%20user',
        Password: 'pass',
        isBeta: true,
      };

      await rfi.connect(data);

      expect(rfi.db.connect).toHaveBeenCalledWith('test user', 'pass', true);
    });

    test('should use PASSWORD if Password not present', async () => {
      const data = {
        VPUserName: 'user',
        PASSWORD: 'pwd',
        isBeta: false,
      };

      await rfi.connect(data);

      expect(rfi.db.connect).toHaveBeenCalledWith('user', 'pwd', false);
    });
  });

  describe('post', () => {
    test('should return error if no data sent', async () => {
      const result = await rfi.post();
      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    test('should return error for invalid JSON', async () => {
      const result = await rfi.post('{invalid json');
      expect(result).toEqual({ error: 'Invalid JSON data!', num_code: 304 });
    });

    test('should save on success', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        cols: ['col1', 'col2'],
        rows: [['val1', 'val2']],
        dcols: ['dcol1'],
        drows: [['dval1']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 0, ReturnMessage: 'Success' },
        recordset: [],
      });

      const result = await rfi.post(data);

      expect(mockDb.request).toHaveBeenCalled();
      expect(mockRequest.input).toHaveBeenCalledWith('originalUser', 'user');
      expect(mockRequest.execute).toHaveBeenCalledWith('mmspSyncInRFIs');
      expect(result).toBe('Success');
    });

    test('should throw error on save failure', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        cols: ['col1'],
        rows: [['val']],
        dcols: ['dcol'],
        drows: [['dval']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 1, ReturnMessage: 'Error occurred' },
      });

      await expect(rfi.post(data)).rejects.toThrow('Error occurred');
    });
  });

  describe('delete_rfi', () => {
    test('should return error if no data sent', async () => {
      const result = await rfi.delete_rfi();
      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    test('should save on success for delete', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        cols: ['col1'],
        rows: [['val']],
        dcols: ['dcol'],
        drows: [['dval']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 0, ReturnMessage: 'Deleted' },
        recordset: [],
      });

      const result = await rfi.delete_rfi(data);

      expect(mockDb.request).toHaveBeenCalled();
      expect(mockRequest.input).toHaveBeenCalledWith('originalUser', 'user');
      expect(mockRequest.execute).toHaveBeenCalledWith('mmspSyncInRFIs');
      expect(result).toBe('Deleted');
    });
  });

  describe('check_key_fields', () => {
    test('should not throw error since no keys to check', () => {
      expect(() => rfi.check_key_fields({})).not.toThrow();
    });
  });

  describe('save_rfi_to_db', () => {
    test('should save data to db successfully', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        cols: ['col1', 'col2'],
        rows: [['val1', 'val2'], ['val3', 'val4']],
        dcols: ['dcol1', 'dcol2'],
        drows: [['dval1', 'dval2']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 0, ReturnMessage: 'Success' },
        recordset: [],
      });

      const result = await rfi.save_rfi_to_db(data);

      expect(mockDb.request).toHaveBeenCalled();
      expect(result).toBe('Success');
      expect(mockRequest.input).toHaveBeenCalledWith('originalUser', 'user');
      expect(mockRequest.input).toHaveBeenCalledWith('cols', 'col1,col2');
      expect(mockRequest.input).toHaveBeenCalledWith('rows', 'val1\tval2\rval3\tval4');
      expect(mockRequest.input).toHaveBeenCalledWith('dcols', 'dcol1,dcol2');
      expect(mockRequest.input).toHaveBeenCalledWith('drows', 'dval1\tdval2');
      expect(mockRequest.output).toHaveBeenCalledWith('rcode', 0);
      expect(mockRequest.output).toHaveBeenCalledWith('ReturnMessage', '');
    });

    test('should throw error if rcode is 1', async () => {
      const data = {
        VPUserName: 'user',
        Password: 'pass',
        cols: ['col'],
        rows: [['val']],
        dcols: ['dcol'],
        drows: [['dval']],
      };

      mockRequest.execute.mockResolvedValue({
        output: { rcode: 1, ReturnMessage: 'Failure' },
      });

      await expect(rfi.save_rfi_to_db(data)).rejects.toThrow('Failure');

      expect(mockDb.request).toHaveBeenCalled();
    });
  });

  describe('array_2d_to_str', () => {
    test('should convert 2d array to string with separators and replace rsep', () => {
      const arr = [['a', 'b'], ['c\r', 'd']];
      const result = rfi.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('a\tb\rc\n\td');
    });

    test('should handle single row', () => {
      const arr = [['x\n', 'y']];
      const result = rfi.array_2d_to_str(arr, ',', '\n');
      expect(result).toBe('x\n,y');
    });

    test('should handle empty array', () => {
      const arr = [];
      const result = rfi.array_2d_to_str(arr, '\t', '\r');
      expect(result).toBe('');
    });
  });
});