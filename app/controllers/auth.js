const { poolPromise, sql } 	= require('../connectors/db');
const values 			= require('object.values');
var jwt 		    = require('jwt-simple');
const { getUnixTime, addDays } = require('date-fns');
var LdapAuth 	  = require('ldapauth-fork');
var Promise  	  = require('promise');
if (!Object.values) values.shim();

let ldapSettings = {
  url: process.env.LDAP_URL,
  searchBase: process.env.LDAP_SEARCH_BASE,
  searchFilter: process.env.LDAP_SEARCH_FILTER,
  _timeout: 5000,
	_connectTimeout: 10000,
	reconnect: true,
	searchAttributes: ["cn","mail","sAMAccountName"],
	checkInterval : 1500,
	maxIdleTime : 1800,
}

var auth = new LdapAuth(ldapSettings);

// Added to catch error and remove restarts.
auth.on('error', (err) => {
	console.warn('LdapAuth error:', err);
});


// Catch errors so app does not crash
auth._adminClient.on('error', err => {
	console.warn('_adminClient: LDAP connection dropped, reconnecting.');
});
auth._userClient.on('error', err => {
	console.warn('_userClient: LDAP connection dropped, reconnecting.');
});

const JWT_TOKEN_SECRET = process.env.JWT_SECRET;

module.exports = class Auth {

	check(req) {
		return poolPromise.then((pool) => pool.request()
			.input('UUID', 			 sql.VarChar(40), 		req.headers['x-uuid' ]	)
			.input('Phone', 		 sql.VarChar(20), 		req.headers['x-phone']	)
			.input('Email', 		 sql.VarChar(40), 		req.headers['x-email']	)
			.input('Code', 			 sql.VarChar( 6),		  req.headers['x-code' ]	)
			.input('Password', 	 sql.VarChar( 6),		  req.headers['x-pass' ]	)
			.input('SMCo', 			 sql.Int,			      	req.headers['x-hqco' ]	)
			.output('PRCo', 		 sql.Int										)
			.output('Employee', 	 sql.Int										)
			.output('Technician', 	 sql.VarChar(  20)								)
			.output('ReturnMessage', sql.VarChar(8000)								)
			.execute('mspCheckDeviceRegistration')
		).then(result =>{
			if (result.returnValue!==1) return result;
			throw new Error(result.output.ReturnMessage);
		}).catch((err) => {
			throw new Error(err.message || err.toString());
		});
	}

	employeeInfo(prco, employee) {
		return poolPromise.then( pool => pool.request()
			.input('PRCo',		sql.Int,		prco)
			.input('Employee', 	sql.Int,	employee)
			.query('SELECT PRCo, Employee, FirstName, LastName, Email FROM PREHName WHERE PRCo=@PRCo AND Employee=@Employee')
		).then(result =>{
			return result.recordset[0];
		}).catch(err => {
			throw new Error(err.toString());
		});
	}

	// JWT related functions, copied from cepm-vp-auth on 2025-11-28 and modified.
	verify(token) {
   	if (token) {
  		try {
   			var decoded = jwt.decode(token, JWT_TOKEN_SECRET);

   			if (decoded.exp < getUnixTime(new Date())) {
          throw new Error('Access token has expired');
   			} else {
          return decoded;
   			}
  		} catch (err) {
        throw new Error('Access token could not be decoded');
  		}
   	} else {
        throw new Error('Access token is missing');
   	}
	}

	authenticate(username, password) {
		auth = new LdapAuth(ldapSettings);	// Added so it makes a NEW connection for every request.

		// Added to catch error and remove restarts.
		auth.on('error', (err) => {
			console.warn('LdapAuth error:', err);
		});

		return new Promise(function (resolve, reject) {
			auth.authenticate(username, password, function (err, user) {
				if(err)
					reject(err);
				else if (!user)
          reject(new Error('Authentication failed: invalid user'));
				else
					resolve(user);
			});
		});
	}

	authenticateHandler({ username, password }) {
		if(username && password) {
			return this.authenticate(username, password)
				.then(function(user) {
					var expires = getUnixTime(addDays(new Date(), 2));
					var token = jwt.encode({
						exp: expires,
						user_name: process.env.DOMAIN_PREPEND + "\\" + user.sAMAccountName,
						full_name: user.cn,
						mail: user.mail
					}, JWT_TOKEN_SECRET);

          return { token: token, full_name: user.cn };
				})
				.catch(function (err) {
					// Ldap reconnect config needs to be set to true to reliably
					// land in this catch when the connection to the ldap server goes away.
					// REF: https://github.com/vesse/node-ldapauth-fork/issues/23#issuecomment-154487871

					if (err.name === 'InvalidCredentialsError' || (typeof err === 'string' && err.match(/no such user/i)) ) {
            console.warn(err.message);
						throw new Error('Invalid username or password');
					} else {
						// ldapauth-fork or underlying connections may be in an unusable state.
						// Reconnect option does re-establish the connections, but will not
						// re-bind. Create a new instance of LdapAuth.
						// REF: https://github.com/vesse/node-ldapauth-fork/issues/23
						// REF: https://github.com/mcavage/node-ldapjs/issues/318

						auth = new LdapAuth(ldapSettings);
						// Added to catch error and remove restarts.
            auth.on('error', (err) => {
           		console.warn('LdapAuth error:', err);
            });
						console.log(err);
						throw new Error('Unexpected Error during authentication');
					}
				});
		} else {
		  throw new Error('No username or password supplied');
		}
	}

}
