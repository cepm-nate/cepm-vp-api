let mockPool;
let mockExecute = jest.fn();
let mockQuery = jest.fn();

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

const Equipment = require('../equipment');

describe('Equipment', () => {
  let equipment;

  beforeEach(() => {
    equipment = new Equipment();
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ recordset: [], output: { rcode: 0, ReturnMessage: 'Success' } });
  });

  describe('constructor', () => {
    it('should initialize USER_DOMAIN and db', () => {
      expect(equipment.USER_DOMAIN).toBe('CORP\\');
      expect(equipment.db).toBeInstanceOf(require('../../db/mssql'));
    });
  });

  describe('connect', () => {
    it('should call db.connect with decoded username, password, and isBeta', async () => {
      const data = { VPUserName: 'test%20user', Password: 'pass', isBeta: true };
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      await equipment.connect(data);

      expect(mockDbConnect).toHaveBeenCalledWith('test user', 'pass', true);
    });

    it('should handle PASSWORD instead of Password', async () => {
      const data = { VPUserName: 'user', PASSWORD: 'pass', isBeta: false };
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      await equipment.connect(data);

      expect(mockDbConnect).toHaveBeenCalledWith('user', 'pass', false);
    });
  });

  describe('post', () => {
    it('should return error if no data', async () => {
      const result = await equipment.post('');

      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    it('should return error for invalid JSON', async () => {
      const result = await equipment.post('invalid json');

      expect(result).toEqual({ error: 'Invalid JSON data!', num_code: 304 });
    });

    it('should parse string data and call save_em_to_db', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      const jsonData = JSON.stringify(data);
      const mockSave = jest.spyOn(equipment, 'save_em_to_db').mockResolvedValue({ Message: 'Success', Changes: [] });
      const mockCheckKey = jest.spyOn(equipment, 'check_key_fields');
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      const result = await equipment.post(jsonData);

      expect(mockCheckKey).toHaveBeenCalledWith(data);
      expect(mockDbConnect).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalledWith(data);
      expect(result).toEqual({ Message: 'Success', Changes: [] });
    });

    it('should handle object data directly', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      const mockSave = jest.spyOn(equipment, 'save_em_to_db').mockResolvedValue({ Message: 'Success', Changes: [] });
      const mockCheckKey = jest.spyOn(equipment, 'check_key_fields');
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      const result = await equipment.post(data);

      expect(mockCheckKey).toHaveBeenCalledWith(data);
      expect(mockDbConnect).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalledWith(data);
      expect(result).toEqual({ Message: 'Success', Changes: [] });
    });
  });

  describe('post_part_transfer', () => {
    it('should return error if no data', async () => {
      const result = await equipment.post_part_transfer('');

      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    it('should parse data and call save_empt_to_db', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      const mockSave = jest.spyOn(equipment, 'save_empt_to_db').mockResolvedValue({ Message: 'Success', Changes: [] });
      const mockCheckKey = jest.spyOn(equipment, 'check_key_fields');
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      const result = await equipment.post_part_transfer(data);

      expect(mockCheckKey).toHaveBeenCalledWith(data);
      expect(mockDbConnect).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalledWith(data);
      expect(result).toEqual({ Message: 'Success', Changes: [] });
    });
  });

  describe('delete_part_transfer', () => {
    it('should return error if no data', async () => {
      const result = await equipment.delete_part_transfer('');

      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    it('should parse data and call save_empt_to_db', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      const mockSave = jest.spyOn(equipment, 'save_empt_to_db').mockResolvedValue({ Message: 'Success', Changes: [] });
      const mockCheckKey = jest.spyOn(equipment, 'check_key_fields');
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      const result = await equipment.delete_part_transfer(data);

      expect(mockCheckKey).toHaveBeenCalledWith(data);
      expect(mockDbConnect).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalledWith(data);
      expect(result).toEqual({ Message: 'Success', Changes: [] });
    });
  });

  describe('post_transfer', () => {
    it('should return error if no data', async () => {
      const result = await equipment.post_transfer('');

      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    it('should parse data and call save_trx_to_db', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      const mockSave = jest.spyOn(equipment, 'save_trx_to_db').mockResolvedValue({ Message: 'Success', Changes: [] });
      const mockCheckKey = jest.spyOn(equipment, 'check_key_fields');
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      const result = await equipment.post_transfer(data);

      expect(mockCheckKey).toHaveBeenCalledWith(data);
      expect(mockDbConnect).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalledWith(data);
      expect(result).toEqual({ Message: 'Success', Changes: [] });
    });
  });

  describe('delete_transfer', () => {
    it('should return error if no data', async () => {
      const result = await equipment.delete_transfer('');

      expect(result).toEqual({ error: 'No Data Sent!', num_code: 303 });
    });

    it('should parse data and call save_trx_to_db', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      const mockSave = jest.spyOn(equipment, 'save_trx_to_db').mockResolvedValue({ Message: 'Success', Changes: [] });
      const mockCheckKey = jest.spyOn(equipment, 'check_key_fields');
      const mockDbConnect = jest.spyOn(equipment.db, 'connect').mockResolvedValue();

      const result = await equipment.delete_transfer(data);

      expect(mockCheckKey).toHaveBeenCalledWith(data);
      expect(mockDbConnect).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalledWith(data);
      expect(result).toEqual({ Message: 'Success', Changes: [] });
    });
  });

  describe('check_key_fields', () => {
    it('should not throw or do anything', () => {
      expect(() => equipment.check_key_fields({})).not.toThrow();
    });
  });

  describe('save_em_to_db', () => {
    it('should execute stored procedure and return success', async () => {
      const data = { VPUserName: 'user', cols: ['col1', 'col2'], rows: [['val1', 'val2'], ['val3', 'val4']] };
      mockExecute.mockResolvedValue({
        recordset: [{ id: 1 }],
        output: { rcode: 0, ReturnMessage: 'Success' }
      });

      const result = await equipment.save_em_to_db(data);

      expect(mockPool.request).toHaveBeenCalled();
      expect(result.Message).toBe('Success');
      expect(result.Changes).toEqual([{ id: 1 }]);
    });

    it('should throw error if rcode is 1', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      mockExecute.mockResolvedValue({ output: { rcode: 1, ReturnMessage: 'Error message' } });

      await expect(equipment.save_em_to_db(data)).rejects.toThrow('Error message');
    });
  });

  describe('save_trx_to_db', () => {
    it('should execute stored procedure for transfer', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      mockExecute.mockResolvedValue({
        recordset: [],
        output: { rcode: 0, ReturnMessage: 'Transferred' }
      });

      const result = await equipment.save_trx_to_db(data);

      expect(result.Message).toBe('Transferred');
      expect(result.Changes).toEqual([]);
    });

    it('should throw error if rcode is 1', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      mockExecute.mockResolvedValue({ output: { rcode: 1, ReturnMessage: 'Error' } });

      await expect(equipment.save_trx_to_db(data)).rejects.toThrow('Error');
    });
  });

  describe('save_empt_to_db', () => {
    it('should execute stored procedure for part transfer', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      mockExecute.mockResolvedValue({
        recordset: [],
        output: { rcode: 0, ReturnMessage: 'Part Transferred' }
      });

      const result = await equipment.save_empt_to_db(data);

      expect(result.Message).toBe('Part Transferred');
      expect(result.Changes).toEqual([]);
    });

    it('should throw error if rcode is 1', async () => {
      const data = { VPUserName: 'user', cols: ['col1'], rows: [['val1']] };
      mockExecute.mockResolvedValue({ output: { rcode: 1, ReturnMessage: 'Error' } });

      await expect(equipment.save_empt_to_db(data)).rejects.toThrow('Error');
    });
  });

  describe('array_2d_to_str', () => {
    it('should convert 2D array to string with separators', () => {
      const arr = [['a', 'b'], ['c', 'd']];
      const result = equipment.array_2d_to_str(arr, '\t', '\r');

      expect(result).toBe('a\tb\rc\td');
    });

    it('should handle empty array', () => {
      const arr = [];
      const result = equipment.array_2d_to_str(arr, '\t', '\r');

      expect(result).toBe('');
    });

    it('should handle single row', () => {
      const arr = [['x']];
      const result = equipment.array_2d_to_str(arr, ',', '\n');

      expect(result).toBe('x');
    });

    it('should escape row separators in fields', () => {
      const arr = [['a\r', 'b']];
      const result = equipment.array_2d_to_str(arr, '\t', '\r');

      expect(result).toBe('a\n\tb');
    });
  });
});