const { poolPromise, sql } = require("../connectors/db");
const values = require("object.values");
const { format } = require("date-fns");
if (!Object.values) values.shim();

module.exports = class PhyCnts {
  constructor() {
    this.start = 0;
  }

  dateFormat(dt, fmt) {
     if (!dt) return null;
     if (dt.length === 0) return null;
     const dt2 = this.dateFromDb(dt);
     if (!isValid(dt2)) return null;
     return format(dt2, fmt);
	}

	dateFromDb(t) {
     if (!t) return null;
     if (Object.prototype.toString.call(t) === '[object Date]') return t; // Already a date
     const st = t.slice(-1) === 'Z' ? t.slice(0, -1) : t;
     return parseISO(st);
   }

  findSince(req) {
    var last_seq = req.params.last_seq;
    this.start = new Date();

    var promises = [
      this._querySince(last_seq).then(this._transformIntoRows),
      this._getChangeTrackingCurrentVersion(),
    ];

    return Promise.all(promises).then((results) => {
      return {
        PhyCounts: results[0].rows,
        LAST_SEQ: results[1],
        IsFullLoad: results[0].output.ChangeTrackNum == "0",
        ExecutionTime: new Date() - this.start,
      };
    });
  }

  // findSingle(req) {
  //   var id = req.params.id;
  //   this.start = new Date();

  //   return this._querySingle(id)
  //     .then(this._transformIntoRows)
  //     .then((results) => {
  //       return {
  //         PhyCounts: results.rows,
  //         ExecutionTime: new Date() - this.start,
  //         Sent: { _id: id },
  //       };
  //     });
  // }

  save(req) {
    var updates = req.body.updated || [];
    var deletes = req.body.deleted || [];
    var promises = [];
    var here = this;

    updates.forEach(function (change) {
      promises.push(here._upsertIntoSQL(change, false));
    });

    deletes.forEach(function (id) {
      promises.push(here._upsertIntoSQL({ _id: id }, true));
    });

    return Promise.all(promises)
      .then((rs) => this._querySince(rs[0].output.curChangeNum))
      .then((rs) => this._transformIntoRows(rs))
      .then((freshSaved) => this._composeResult(freshSaved, req.body));
  }

  _querySince(last_seq) {
    const tvpKeys = new sql.Table();
    tvpKeys.columns.add("INCo", sql.Int(20), { nullable: false });
    tvpKeys.columns.add("UserName", sql.VarChar(128), { nullable: false });
    tvpKeys.columns.add("Loc", sql.VarChar(10), { nullable: false });
    tvpKeys.columns.add("MatlGroup", sql.Int(20), { nullable: false });
    tvpKeys.columns.add("Material", sql.VarChar(20), { nullable: false });

    return poolPromise.then((pool) =>
      pool
        .request()
        .input("PhyCountKeys", tvpKeys)
        .output("ChangeTrackNum", sql.BigInt, Number(last_seq))
        .output("rcode", sql.Int, 0)
        .output("ReturnMessage", sql.VarChar(255), "")
        .execute("mmspGatherINPhyCountWkSheets"),
    );
  }

  // _querySingle(inco, username, loc, matlgroup, material) {
  //   const tvpKeys = new sql.Table();
  //   tvpKeys.columns.add("INCo", sql.Int(20), { nullable: false });
  //   tvpKeys.columns.add("UserName", sql.VarChar(128), { nullable: false });
  //   tvpKeys.columns.add("Loc", sql.VarChar(10), { nullable: false });
  //   tvpKeys.columns.add("MatlGroup", sql.Int(20), { nullable: false });
  //   tvpKeys.columns.add("Material", sql.VarChar(20), { nullable: false });

  //   // print_r(tvpKeys);
  //   return poolPromise.then((pool) =>
  //     pool
  //       .request()
  //       .input("PhyCountKeys", tvpKeys)
  //       .output("ChangeTrackNum", sql.BigInt, 0)
  //       .output("rcode", sql.Int, 0)
  //       .output("ReturnMessage", sql.VarChar(255), "")
  //       .execute("mmspGatherINPhyCountWkSheets"),
  //   );
  // }

  _transformIntoRows(rows) {
    // If there are no rows, do not bother continuing, and no need to save the current version.
    if (!rows.recordset)
      return Promise.reject({
        message: " - Missing recordset!",
      });

    if (rows.recordset.length === 0)
      return Promise.resolve({ rows: [], output: rows.output });

    // compact same rows into 'PartTransfers' within each row
    var newRows = {};
    for (var i = rows.recordset.length - 1; i > -1; i--) {
      var row = rows.recordset[i];
      // If _id is an array !!!!, turn it into a normal value
      if (typeof row._id === "object") row._id = row._id[0];
      // If this row has NO ROW ID, skip it.
      if (row._id === null && row.DELETED === 0) continue;
      // Create if it does not exist
      if (typeof newRows[row._id] === "undefined") newRows[row._id] = row;
    }
    newRows = Object.keys(newRows).map(function (key) {
      return newRows[key];
    });
    //console.log('output new rows',newRows.map(function(r){return r._id+':'+r.DELETED}));

    return Promise.resolve({ rows: newRows || [], output: rows.output });
  }

  _upsertIntoSQL(tx, isDelete) {
    // Create TVP for EMLocation History
    const tvpTrx = new sql.Table();
    tvpTrx.columns.add("INCo", sql.TinyInt, { nullable: false });
    tvpTrx.columns.add("UserName", sql.VarChar(128), { nullable: false });
    tvpTrx.columns.add("Loc", sql.VarChar(10), { nullable: false });
    tvpTrx.columns.add("MatlGroup", sql.Int, { nullable: false });
    tvpTrx.columns.add("Material", sql.VarChar(23), { nullable: false });
    tvpTrx.columns.add("UM", sql.VarChar(3), { nullable: false });
    tvpTrx.columns.add("PhyCnt", sql.Numeric(12, 3), { nullable: false });
    tvpTrx.columns.add("CntDate", sql.VarChar(23), { nullable: true });
    tvpTrx.columns.add("CntBy", sql.VarChar(128), { nullable: true });
    tvpTrx.columns.add("SysCnt", sql.Numeric(12, 3), { nullable: true });
    tvpTrx.columns.add("AdjUnits", sql.Numeric(12, 3), { nullable: true });
    tvpTrx.columns.add("UnitCost", sql.Numeric(16, 5), { nullable: true });
    tvpTrx.columns.add("ECM", sql.VarChar(1), { nullable: true });
    tvpTrx.columns.add("Ready", sql.VarChar(1), { nullable: true });
    tvpTrx.columns.add("Description", sql.VarChar(30), { nullable: true });
    tvpTrx.columns.add("udPhyLoc", sql.VarChar(30), { nullable: true });
    tvpTrx.columns.add("udBinNo", sql.VarChar(20), { nullable: true });
    tvpTrx.columns.add("udFilter", sql.VarChar(200), { nullable: true });

    var idsplit = tx._id.split(":");

    // Copy data from tx into tvpTrx
    tvpTrx.rows.add(
      Number(tx.INCo) || idsplit[0],
      tx.UserName || idsplit[1],
      tx.Loc || idsplit[2],
      Number(tx.MatlGroup) || idsplit[3],
      tx.Material || idsplit[4],
      tx.UM || "XXX",
      tx.PhyCnt === null ? null : Number(tx.PhyCnt), // because when tx.PhyCnt === 0, its seen as false
      // (typeof tx.CntDate !== 'undefined'? Number(tx.CntDate) : null),	// because when tx.CntDate === 0, its seen as false
      // tx.CntDate ? format(new Date(tx.CntDate), "yyyy-MM-dd 00:00:00") : null, // New dateFormat style used.
      this.dateFormat(tx.CntDate, "yyyy-MM-dd 00:00:00"), // possibly null
      tx.CntBy || null,
      typeof tx.SysCnt !== "undefined" ? Number(tx.SysCnt) : null,
      typeof tx.AdjUnits !== "undefined" ? Number(tx.AdjUnits) : null,
      typeof tx.UnitCost !== "undefined" ? Number(tx.UnitCost) : null,
      tx.ECM || "E", // Default to EACHES
      tx.Ready || "N", // Default to NOT ready
      tx.SheetGroup || null,
      tx.PhyLoc || null,
      tx.BinNo || null,
      tx.Filter || null,
    );

    return poolPromise.then((pool) =>
      pool
        .request()
        .input("isDelete", isDelete ? "Y" : "N")
        .input("inCounts", tvpTrx)
        .output("curChangeNum", sql.BigInt, 0)
        .output("rcode", sql.Int, 0)
        .output("ReturnMessage", sql.VarChar(255), "")
        .execute("mmspUpsertINPhyCounts"),
    );
  }

  _getChangeTrackingCurrentVersion() {
    return poolPromise
      .then((pool) =>
        pool
          .request()
          .query("SELECT CHANGE_TRACKING_CURRENT_VERSION() AS ctnum"),
      )
      .then((r) => {
        return r.recordset[0].ctnum;
      });
  }

  _composeResult(freshSaved, body) {
    return {
      sent: body,
      onServer: freshSaved || [],
    };
  }
};
