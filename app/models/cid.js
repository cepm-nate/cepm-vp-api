const MssqlConnection = require('../db/mssql');

class CID {
  constructor() {
    this.db = new MssqlConnection();
  }

  async connect(username, password) {
    try {
      await this.db.connect(username, password, false);
    } catch (err) {
      console.error('Database connection failed:', err);
      throw err;
    }
  }

  async get_phonenumber(data) {
    await this.connect(data.u, data.p);

    const prco = data.c;
    const phonenum = data.phone;
    let fullname = '';

    const request = await this.db.request();
    request.input('prco', prco);
    request.input('phonenumber', phonenum);
    request.output('fullname', fullname);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    try {
      const result = await request.execute('mmspGetPhoneNumber');

      const rcode = result.output.rcode;
      const out_msg = result.output.ReturnMessage;

      if (rcode === 1) {
        throw new Error(out_msg);
      }

      fullname = result.output.fullname;
      fullname = fullname.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

      return {
        FirstName: fullname,
        LastName: '',
        Phone: data.phone,
        number: data.phone
      };
    } catch (err) {
      console.error('Error in get_phonenumber:', err);
      throw err;
    }
  }
}

module.exports = CID;