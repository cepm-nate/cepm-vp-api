// Jest setup file

// Mock dotenv to prevent loading real environment variables in tests
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock mssql module globally if needed
jest.mock('mssql', () => ({
  ConnectionPool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      request: jest.fn().mockReturnThis(),
      input: jest.fn().mockReturnThis(),
      output: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ recordset: [], output: {} }),
      query: jest.fn().mockResolvedValue({ recordset: [{ ctnum: 123 }] }),
    }),
  })),
  VarChar: jest.fn(),
  TinyInt: jest.fn(),
  BigInt: jest.fn(),
  Int: jest.fn(),
  Char: jest.fn(),
  Table: jest.fn().mockImplementation(() => ({
    columns: { add: jest.fn() },
    rows: { add: jest.fn() },
  })),
}));

// Mock ldapauth-fork
jest.mock('ldapauth-fork', () => jest.fn().mockImplementation(() => ({
  authenticate: jest.fn().mockResolvedValue({}),
  close: jest.fn(),
})));

// Mock jwt-simple
jest.mock('jwt-simple', () => ({
  encode: jest.fn().mockReturnValue('fake-jwt'),
  decode: jest.fn().mockImplementation((token, secret) => {
    if (token === 'invalid') {
      throw new Error('Invalid token');
    }
    return { exp: 2000000000 };
  }),
}));

const mockAllSettled = jest.fn();

// Mock promise
jest.mock('promise', () => {
  const MockPromise = function(executor) {
    return new global.Promise(executor);
  };
  MockPromise.allSettled = mockAllSettled;
  MockPromise.resolve = jest.fn();
  MockPromise.reject = jest.fn();
  MockPromise.all = jest.fn();
  return MockPromise;
});

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(''),
}));

// Mock fs to avoid file system interactions
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

// Suppress console.warn in tests if not needed
const originalWarn = console.warn;
console.warn = jest.fn();

process.env.JWT_SECRET = 'secret';

// After each test, clear all mocks
afterEach(() => {
  jest.clearAllMocks();
  console.warn = originalWarn; // restore if needed, but since mocked, perhaps not
});