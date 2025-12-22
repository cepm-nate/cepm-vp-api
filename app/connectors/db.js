//const sql 	= require('mssql/msnodesqlv8');	///msnodesqlv8
const sql 	= require('mssql');

const dbConfig = {
  user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	server: process.env.DB_SERVER,
	database: process.env.DB_DATABASE,
  options: {
		useUTC: !!process.env.DB_USE_UTC, // workaround for lack of boolean support in dot env.
		pool: {
      min: process.env.DB_POOL_MIN,
      max: process.env.DB_POOL_MAX,
      idleTimeoutMillis: process.env.DB_POOL_IDLE_TIMEOUT
		}
  }
}

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL')
    return pool
  })
  .catch(err => console.log('Database Connection Failed! Bad Config: ', err));


module.exports = {
  sql, poolPromise
}
