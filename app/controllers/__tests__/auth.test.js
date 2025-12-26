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

jest.mock('ldapauth-fork');
jest.mock('jwt-simple', () => ({
  decode: jest.fn(),
  encode: jest.fn().mockReturnValue('fake-jwt'),
}));

jest.mock('date-fns', () => ({
  getUnixTime: jest.fn(),
  addDays: jest.fn(),
}));

const Auth = require('../auth');

const jwt = require('jwt-simple');
const LdapAuth = require('ldapauth-fork');
const dateFns = require('date-fns');

describe('Auth Controller', () => {
  let auth, mockLdapInstance, mockExpiredObj, mockReject;
  const mockUser = { sAMAccountName: 'testuser', cn: 'Test User', mail: 'test@example.com' };

  beforeEach(() => {
    auth = new Auth();
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ returnValue: 1, output: { ReturnMessage: '' }, recordset: [{}] });
    mockQuery.mockResolvedValue({ recordset: [{ PRCo: 1, Employee: 123, FirstName: 'John', LastName: 'Doe', Email: 'john.doe@example.com' }] });
    jwt.decode.mockImplementation((token, secret) => {
      if (token === 'invalid') {
        throw new Error('Invalid token');
      }
      return { exp: mockExpiredObj.value ? 0 : 2000000000 };
    });
    dateFns.getUnixTime.mockReturnValue(1000000000);
    jwt.encode = jest.fn().mockReturnValue('fake-jwt');
    mockLdapInstance = {
      authenticate: jest.fn().mockImplementation((username, password, callback) => {
        if (mockReject) {
          callback(mockReject, null);
        } else {
          callback(null, mockUser);
        }
      }),
      close: jest.fn(),
      on: jest.fn(),
    };
    LdapAuth.mockImplementation(() => mockLdapInstance);
    mockExpiredObj = { value: false };
    mockReject = null;
  });

  describe('check', () => {
    it('should execute stored procedure and throw error if successful', async () => {
      const req = {
        headers: {
          'x-uuid': 'uuid123',
          'x-phone': '555-1234',
          'x-email': 'email@example.com',
          'x-code': '123456',
          'x-pass': 'password',
          'x-hqco': 1,
        },
      };

      await expect(auth.check(req)).rejects.toThrow('');
    });

    it('should return result if execution fails', async () => {
      mockExecute.mockResolvedValue({ returnValue: 0, output: { ReturnMessage: 'Invalid device' } });

      const req = { headers: {} };

      const result = await auth.check(req);
      expect(result.returnValue).toBe(0);
      expect(result.output.ReturnMessage).toBe('Invalid device');
    });
  });

  describe('employeeInfo', () => {
    it('should query employee info and return record', async () => {
      const result = await auth.employeeInfo(1, 123);

      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual({
        PRCo: 1,
        Employee: 123,
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john.doe@example.com',
      });
    });

    it('should throw error if query fails', async () => {
      mockQuery.mockRejectedValue(new Error('DB error'));

      await expect(auth.employeeInfo(1, 123)).rejects.toThrow('DB error');
    });
  });

  describe('verify', () => {
    it('should return decoded token if valid', () => {
      const result = auth.verify('token123');

      expect(jwt.decode).toHaveBeenCalledWith('token123', process.env.JWT_SECRET);
      expect(result.exp).toBe(2000000000);
    });

    it('should throw error if token is expired', () => {
      mockExpiredObj.value = true;

      expect(() => auth.verify('token123')).toThrow('Access token has expired');
    });

    it('should throw error if token is missing', () => {
      expect(() => auth.verify('')).toThrow('Access token is missing');
    });

    it('should throw error if token cannot be decoded', () => {
      expect(() => auth.verify('invalid')).toThrow('Access token could not be decoded');
    });
  });

  describe('authenticate', () => {
    it('should authenticate user successfully', async () => {
      mockReject = null;

      const result = await auth.authenticate('testuser', 'password');

      expect(mockLdapInstance.authenticate).toHaveBeenCalled();
      expect(mockLdapInstance.close).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should reject if authentication fails', async () => {
      mockReject = new Error('LDAP error');

      await expect(auth.authenticate('testuser', 'password')).rejects.toThrow('LDAP error');
    });
  });

  describe('authenticateHandler', () => {
    it('should authenticate and return token', async () => {
      mockReject = null;

      const result = await auth.authenticateHandler({ username: 'testuser', password: 'password' });

      expect(result.token).toBe('fake-jwt');
      expect(result.full_name).toBe('Test User');
      expect(jwt.encode).toHaveBeenCalled();
    });

    it('should throw error for invalid credentials', async () => {
      mockReject = new Error('InvalidCredentialsError');
      mockReject.name = 'InvalidCredentialsError';

      await expect(auth.authenticateHandler({ username: 'wrong', password: 'wrong' })).rejects.toThrow('Invalid username or password');
    });

    it('should throw error if username or password missing', () => {
      expect(() => auth.authenticateHandler({})).toThrow('No username or password supplied');
    });

    it('should throw error for no such user', async () => {
      mockReject = new Error('no such user');

      await expect(auth.authenticateHandler({ username: 'wrong', password: 'wrong' })).rejects.toThrow('Unexpected Error during authentication');
    });

    it('should throw unexpected error', async () => {
      mockReject = new Error('Some other error');

      await expect(auth.authenticateHandler({ username: 'test', password: 'test' })).rejects.toThrow('Unexpected Error during authentication');
    });
  });
});