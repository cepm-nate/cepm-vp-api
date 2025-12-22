const { exec } = require('child_process');

class LocalDB {
  constructor() {
    // No properties needed, as it's just a utility class
  }

  async create_dump(db_path, dump_path) {
    const command = `sqlite3 ${db_path} .dump > ${dump_path}`;

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = LocalDB;