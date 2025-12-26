
let mockRequest;
let mockExecute = jest.fn();
let mockQuery = jest.fn();

jest.mock('../../db/mssql', () => {
  mockRequest = {
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    execute: mockExecute,
    query: mockQuery,
  };

  class MockMssqlConnection {
    connect = jest.fn();
    request = jest.fn().mockReturnValue(mockRequest);
    query = mockQuery;
  }

  return MockMssqlConnection;
});

const API = require('../api');

describe('API', () => {
  let api;

  beforeEach(() => {
    api = new API();
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ recordset: [], output: { rcode: 0, ReturnMessage: '' } });
    mockQuery.mockResolvedValue({ recordset: [] });
  });

  describe('constructor', () => {
    it('should initialize properties correctly', () => {
      expect(api.restrictedColumns).toEqual(['SSN', 'RoutingId', 'BankAcct', 'AttachmentData', 'AttachmentFileType']);
      expect(api.restrictedWordsGet).toEqual(['DROP', 'INSERT', 'DELETE', 'UPDATE']);
      expect(api.USER_DOMAIN).toBe('CORP\\');
      expect(api.VPUSERNAME).toBe('');
      expect(api.TO_REPLY).toEqual([]);
      expect(api.db).toBeInstanceOf(require('../../db/mssql'));
    });
  });

  describe('connect', () => {
    it('should call db.connect with decoded username and password', async () => {
      const data = { VPUserName: 'test%20user', Password: 'pass', isBeta: true };
      const mockDbConnect = jest.spyOn(api.db, 'connect').mockResolvedValue();

      await api.connect(data);

      expect(mockDbConnect).toHaveBeenCalledWith('test user', 'pass', true);
    });

    it('should handle PASSWORD instead of Password', async () => {
      const data = { VPUserName: 'user', PASSWORD: 'pass', isBeta: false };
      const mockDbConnect = jest.spyOn(api.db, 'connect').mockResolvedValue();

      await api.connect(data);

      expect(mockDbConnect).toHaveBeenCalledWith('user', 'pass', false);
    });
  });

  describe('clean_data_in', () => {
    it('should clean data by removing restricted columns, ud columns, and normalizing tablename', () => {
      const data = { columns: ['SSN', 'ud_col', 'normal'], table: 'Table@Name!' };

      const result = api.clean_data_in(data);

      expect(result.columns).toEqual(['normal']);
      expect(result.table).toBe('Table@Name!');
    });
  });

  describe('strip_out_restricted_columns', () => {
    it('should remove restricted columns from columns array', () => {
      const data = { columns: ['normal', 'SSN', 'BankAcct'] };

      const result = api.strip_out_restricted_columns(data);

      expect(result.columns).toEqual(['normal']);
    });

    it('should handle data without columns', () => {
      const data = {};

      const result = api.strip_out_restricted_columns(data);

      expect(result).toEqual({});
    });

    it('should handle empty data', () => {
      const data = {};
      const result = api.strip_out_restricted_columns(data);

      expect(result).toEqual({});
    });
  });

  describe('strip_out_ud_columns', () => {
    it('should remove columns starting with ud_ from columns array', () => {
      const data = { columns: ['normal', 'ud_col1', 'ud_col2', 'col'] };

      const result = api.strip_out_ud_columns(data);

      expect(result.columns).toEqual(['normal', 'col']);
    });
  });

  describe('clean_data_tablename', () => {
    it('should clean tablename by removing invalid characters', () => {
      const tablename = 'Table@Name!123';

      const result = api.clean_data_tablename(tablename);

      expect(result).toBe('Table@Name123');
    });
  });

  describe('remove_attachment_columns', () => {
    it('should remove attachment columns from columns array', () => {
      const data = {
        columns: ['col1', 'col2', 'AttachmentData', 'col3', 'AttachmentFileType']
      };

      const result = api.remove_attachment_columns(data);

      expect(result.columns).toEqual(['col1', 'col2', 'col3']);
    });
  });

  describe('get_user_data', () => {
    it('should execute stored procedure and return user data', async () => {
      const data = { VPUserName: 'testuser' };
      mockExecute.mockResolvedValue({
        recordset: [{ name: 'User', SecurityGroups: '1,2' }],
        output: { ReturnMessage: 'Success' }
      });
      const mockConnect = jest.spyOn(api.db, 'connect').mockResolvedValue();

      const result = await api.get_user_data(data);

      expect(mockConnect).toHaveBeenCalledWith('testuser', undefined, false);
      expect(result.user).toEqual([{ name: 'User', SecurityGroups: [1, 2] }]);
      expect(result.message).toBe('Success');
    });
  });

  describe('get_company_data', () => {
    it('should execute stored procedure and return companies', async () => {
      const data = { VPUserName: 'user' };
      mockExecute.mockResolvedValue({
        recordset: [{ id: 1 }],
        output: { ReturnMessage: '' }
      });
      const mockConnect = jest.spyOn(api.db, 'connect').mockResolvedValue();

      const result = await api.get_company_data(data);

      expect(mockConnect).toHaveBeenCalledWith('user', undefined, false);
      expect(result.companies).toEqual([{ id: 1 }]);
      expect(result.message).toBe('');
    });
  });

  describe('get_plugins_settings', () => {
    it('should execute stored procedure and return plugins', async () => {
      const data = { VPUserName: 'user' };
      const pluginName = 'plugin';
      mockExecute.mockResolvedValue({
        recordset: [{ setting: 'value' }],
        output: { ReturnMessage: '' }
      });

      const result = await api.get_plugins_settings(data, pluginName);

      expect(result.plugins).toEqual([{ setting: 'value' }]);
      expect(result.message).toBe('');
    });
  });

  describe('sync_out', () => {
    it('should execute stored procedure and return result', async () => {
      const data = {
        VPUserName: 'user',
        CO: 1,
        syncType: 'type',
        headerTableInfo: {
          tableName: 'table',
          columns: ['col1', 'col2'],
          locking: { column: 'lock', editLevel: 1 },
          keys: ['key1']
        },
        headerRows: [['row1']],
        detailTableInfo: {
          tableName: 'detail',
          columns: ['dcol1'],
        },
        detailRows: [['drow1']],
        ignoreDuplicates: false,
        headerKeys: ['key1']
      };
      mockExecute.mockResolvedValue({
        output: { rcode: 0, ReturnMessage: 'Success' },
        recordset: [{ id: 1 }]
      });

      const result = await api.sync_out(data);

      expect(result).toEqual({
        rcode: 0,
        message: 'Success',
        recordset: [{ id: 1 }]
      });
    });

    it('should throw error if rcode is 1', async () => {
      const data2 = {
        VPUserName: 'user',
        CO: 1,
        syncType: 'type',
        headerTableInfo: { tableName: 'table', columns: [], locking: {}, keys: [] },
        headerRows: [['row']],
        detailTableInfo: { tableName: 'detail', columns: [] },
        detailRows: [],
        ignoreDuplicates: false,
        headerKeys: []
      };
      mockExecute.mockResolvedValue({ output: { rcode: 1, ReturnMessage: 'Error' } });

      await expect(api.sync_out(data2)).rejects.toThrow();
    });
  });

  describe('array_to_fixed_len_string', () => {
    it('should convert array to string with fixed length', () => {
      const arr = ['a', 'bb', 'ccc'];
      const len = 5;

      const result = api.array_to_fixed_len_string(arr, len);

      expect(result).toBe('a    bb   ccc  ');
    });
  });

  describe('cols_and_data_rows_to_xml', () => {
    it('should convert cols and rows to XML string', () => {
      const cols = ['col1', 'col2'];
      const rows = [['val1', 'val2'], ['val3', 'val4']];

      const result = api.cols_and_data_rows_to_xml(cols, rows);

      expect(result).toBe('<Root><Row col1="val1" col2="val2" /><Row col1="val3" col2="val4" /></Root>');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const input = '<div>"Hello & Goodbye"</div>\'test\'';

      const result = api.escapeHtml(input);

      expect(result).toBe('&lt;div&gt;&quot;Hello &amp; Goodbye&quot;&lt;/div&gt;&#039;test&#039;');
    });
  });

  describe('logSync', () => {
    it('should log the sync information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      api.logSync('agent', 'data', 'direction', 'status', true, 'error', false);

      expect(consoleSpy).toHaveBeenCalledWith('LogSync: direction, status: status, error: error');
    });
  });
});
