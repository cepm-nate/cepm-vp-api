// cepm-vp-api/app/connectors/__tests__/db.test.js



describe('db.js', () => {
  let sql, poolPromise;

  beforeEach(() => {
    // Require the module in isolated module scope for fresh execution
    jest.isolateModules(() => {
      // Set up environment variables for testing inside the isolate
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_SERVER = 'localhost';
      process.env.DB_PORT = '1433';
      process.env.DB_DATABASE = 'testdb';
      process.env.DB_USE_UTC = 'true';
      process.env.DB_POOL_MIN = '1';
      process.env.DB_POOL_MAX = '10';
      process.env.DB_POOL_IDLE_TIMEOUT = '30000';

      ({ sql, poolPromise } = require('../db'));
    });
  });

  afterEach(() => {
    // Clear environment variables
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_SERVER;
    delete process.env.DB_PORT;
    delete process.env.DB_DATABASE;
    delete process.env.DB_USE_UTC;
    delete process.env.DB_POOL_MIN;
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_POOL_IDLE_TIMEOUT;
    jest.clearAllMocks();
  });

  test('should export sql and poolPromise', () => {
    expect(sql).toBeDefined();
    expect(poolPromise).toBeDefined();
  });

  test('poolPromise should be a Promise', () => {
    expect(poolPromise).toBeInstanceOf(Promise);
  });

  test('should call ConnectionPool with correct config', () => {
    expect(sql.ConnectionPool).toHaveBeenCalledWith({
      user: 'testuser',
      password: 'testpass',
      server: 'localhost',
      port: '1433',
      database: 'testdb',
      options: {
        useUTC: true,
        enableArithAbort: true,
        trustServerCertificate: true,
        pool: {
          min: '1',
          max: '10',
          idleTimeoutMillis: '30000',
        },
      },
    });
  });

  test('poolPromise should resolve on successful connection', async () => {
    await expect(poolPromise).resolves.toMatchObject({
      request: expect.any(Function),
      input: expect.any(Function),
      output: expect.any(Function),
      execute: expect.any(Function),
      query: expect.any(Function),
    });
  });



});