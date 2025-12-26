const LocalDB = require('../localDB');
const { exec } = require('child_process');

jest.mock('child_process');

describe('LocalDB', () => {
  let localDB;

  beforeEach(() => {
    localDB = new LocalDB();
    jest.clearAllMocks();
  });

  describe('create_dump', () => {
    it('should execute the dump command successfully', async () => {
      const db_path = 'test.db';
      const dump_path = 'dump.sql';
      const expectedCommand = `sqlite3 ${db_path} .dump > ${dump_path}`;

      exec.mockImplementation((command, callback) => {
        callback(null, '', '');
      });

      await expect(localDB.create_dump(db_path, dump_path)).resolves.toBeUndefined();
      expect(exec).toHaveBeenCalledWith(expectedCommand, expect.any(Function));
    });

    it('should reject if exec fails', async () => {
      const db_path = 'test.db';
      const dump_path = 'dump.sql';
      const error = new Error('Dump failed');

      exec.mockImplementation((command, callback) => {
        callback(error, '', '');
      });

      await expect(localDB.create_dump(db_path, dump_path)).rejects.toThrow('Dump failed');
      expect(exec).toHaveBeenCalledWith(`sqlite3 ${db_path} .dump > ${dump_path}`, expect.any(Function));
    });

    it('should handle stderr correctly', async () => {
      // Assuming stderr doesn't affect resolve/reject, but if needed, can test
      const db_path = 'test.db';
      const dump_path = 'dump.sql';

      exec.mockImplementation((command, callback) => {
        callback(null, '', 'Some warning');
      });

      await expect(localDB.create_dump(db_path, dump_path)).resolves.toBeUndefined();
    });
  });
});