
const SQL = require('../sql');

// Mock the MssqlConnection
jest.mock('db/mssql', () => jest.fn());

const MssqlConnection = require('db/mssql');

describe('SQL Class', () => {
  let sql;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      connect: jest.fn().mockResolvedValue(),
    };

    MssqlConnection.mockReturnValue(mockDb);

    sql = new SQL();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(sql.USER_DOMAIN).toBe('CORP\\');
    });
  });

  describe('connect', () => {
    test('should connect with decoded username and password', async () => {
      const data = {
        VPUserName: 'test%20user',
        Password: 'pass',
        isBeta: true,
      };

      await sql.connect(data);

      expect(mockDb.connect).toHaveBeenCalledWith('test user', 'pass', true);
    });

    test('should use PASSWORD if Password not present', async () => {
      const data = {
        VPUserName: 'user',
        PASSWORD: 'pwd',
        isBeta: false,
      };

      await sql.connect(data);

      expect(mockDb.connect).toHaveBeenCalledWith('user', 'pwd', false);
    });
  });
});