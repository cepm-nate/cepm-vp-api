const { poolPromise, sql } 	= require('../connectors/db');
const values 			= require('object.values');
const { format, isValid, parseISO } = require('date-fns');
if (!Object.values) values.shim();

module.exports = class Emtrx {
	constructor(){
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

	findSince(req){
		var last_seq = req.params.last_seq;
		this.start = new Date();

		var promises = [
			this._querySince(last_seq).then( this._transformIntoRows ),
			this._getChangeTrackingCurrentVersion(),
		];

		return Promise.all(promises)
		.then( results => {
			return {
				Transfers	: results[0],
				LAST_SEQ	: results[1],
				ExecutionTime : new Date() - this.start
			}
		})
	}

	findSingle(req){
		var id = req.params.id;
		this.start = new Date();

		return this._querySingle(id)
		.then( this._transformIntoRows )
		.then( results => {
			return {
				Transfers	  : results,
				ExecutionTime : new Date() - this.start,
				Sent		  : { _id : id}
			}
		})
	}

	save(req) {
		var updates  = req.body.updated || [];
		var deletes  = req.body.deleted || [];
		var promises = [];
		var here = this;

		//if ( req.headers.testing ) return Promise.resolve(this._genFakeInsertDeletes(req));

		updates.forEach(function(change){
			promises.push(here._upsertIntoSQL(change, false));
		});

		deletes.forEach(function(id){
			promises.push(here._upsertIntoSQL({ _id: id }, true));
		});

		return Promise.allSettled(promises)
		.then((rs) => {
			let changeNum = null;
			for (let r of rs) {
				if (r.status === 'fulfilled' && r.value.output) {
					changeNum = r.value.output.curChangeNum;
					break;
				}
			}
			if (changeNum === null) {
				return Promise.reject(new Error('All upsert operations failed'));
			}
			return this._querySince(changeNum);
		})
		.then((rs) => this._transformIntoRows(rs) )
		.then((freshSaved) => this._composeResult(freshSaved,req.body));
	}

	_querySince(last_seq){

		const tvpKeys = new sql.Table();
		tvpKeys.columns.add('LocationHistoryId'	, sql.VarChar(20), {nullable: false} );

		return poolPromise.then((pool) => pool.request()
			.input('ChangeTrackNum'	,Number(last_seq) 	)
			.input('TransferKeys'	,tvpKeys		    )
			.output('rcode'			,sql.Int		 , 0)
			.output('ReturnMessage'	,sql.VarChar(255),'')
			.execute('mmspGatherEMLocationHistory'  	)
		)
	}

	_querySingle(id){

		const tvpKeys = new sql.Table();
		tvpKeys.columns.add('LocationHistoryId'	, sql.VarChar(20), {nullable: false} );
		tvpKeys.rows.add(id);

		return poolPromise.then((pool) => pool.request()
			.input('ChangeTrackNum'	,0 					)
			.input('TransferKeys'	,tvpKeys		    )
			.output('rcode'			,sql.Int		 , 0)
			.output('ReturnMessage'	,sql.VarChar(255),'')
			.execute('mmspGatherEMLocationHistory'  	)
		);
	}

	_transformIntoRows(rows)	{

		// If there are no rows, do not bother continuing, and no need to save the current version.
		if ( !rows.recordset ) return Promise.reject({
			message:' - Missing recordset!'
		});

		if ( rows.recordset.length === 0 ) return Promise.resolve([]);

		// compact same rows into 'PartTransfers' within each row
		var newRows = {};
		for ( var i = rows.recordset.length-1; i > -1; i-- ) {
			var row = rows.recordset[i];
			// If this row has NO ROW ID, skip it. Most likely a 'Deleted Part transfer'.
			if ( row._id === null && row.DELETED === 0 ) continue;
			// Generate _id for DELETED rows
			if (row.DELETED === 1) row._id = 'emtrx-' + row.LocationHistoryId;
			// Create transfer if it does not exist
			if ( typeof newRows[row._id] === 'undefined' ) newRows[row._id] = row;
			// Only do the following if this is a part
			if ( row.PartNo !== null ) {
				// Create 'PartTransfers' if does not exist
				if ( typeof newRows[row._id].PartTransfers === 'undefined' ) newRows[row._id].PartTransfers = [];
				// Add this 'part line'
				newRows[row._id].PartTransfers.push({
					PartNo		: row.PartNo,
					ReceivedBy	: row.ReceivedBy,
					ReceivedOn	: row.ReceivedOn,
					ReceivedMemo: row.ReceivedMemo,
					ShippedBy	: row.ShippedBy,
					ShippedOn	: row.ShippedOn,
					ShippedMemo	: row.ShippedMemo,
					KeyID		: row.KeyID
				});
			}
			// Remove the PART TRANSFER details from row.
			delete row.PartNo;
			delete row.ReceivedBy;
			delete row.ReceivedOn;
			delete row.ReceivedMemo;
			delete row.ShippedBy;
			delete row.ShippedOn;
			delete row.ShippedMemo;
			delete row.KeyID;
			delete row.LocationHistoryId;
		};
		newRows = Object.keys(newRows).map(function(key) {
			return newRows[key];
		});
		//console.log('output new rows',newRows.map(function(r){return r._id+':'+r.DELETED}));

		return Promise.resolve(newRows || []);
	}

	_upsertIntoSQL(tx,isDelete) {
		// Create TVP for EMLocation History
		const tvpTrx = new sql.Table();
		tvpTrx.columns.add('LocationHistoryId', sql.VarChar(20),	{nullable: false}	);
		tvpTrx.columns.add('EMCo',				sql.TinyInt,		{nullable: false}	);
		tvpTrx.columns.add('Equipment',			sql.VarChar(10), 	{nullable: false}	);
		tvpTrx.columns.add('Sequence', 			sql.BigInt,			{nullable: false}	);
		tvpTrx.columns.add('DateIn', 			sql.VarChar(19),	{nullable: false}	);
		tvpTrx.columns.add('TimeIn', 			sql.VarChar(19),	{nullable: true}	);
		tvpTrx.columns.add('ToJCCo',			sql.TinyInt,		{nullable: true}	);
		tvpTrx.columns.add('ToJob', 			sql.VarChar(10),	{nullable: true}	);
		tvpTrx.columns.add('ToLocation', 		sql.VarChar(10),	{nullable: true}	);
		tvpTrx.columns.add('Memo', 				sql.VarChar(60),	{nullable: true}	);
		tvpTrx.columns.add('EstDateOut', 		sql.VarChar(19),	{nullable: true}	);
		tvpTrx.columns.add('DateTimeIn',		sql.VarChar(19),	{nullable: true}	);
		tvpTrx.columns.add('Notes', 			sql.VarChar(4000),	{nullable: true}	);
		tvpTrx.columns.add('CreatedBy', 		sql.VarChar(128),	{nullable: false}	);
		tvpTrx.columns.add('CreatedDate', 		sql.VarChar(23),	{nullable: true}	);
		tvpTrx.columns.add('ModifiedBy',		sql.VarChar(128),	{nullable: true}	);
		tvpTrx.columns.add('ModifiedDate', 		sql.VarChar(23),	{nullable: true}	);
		tvpTrx.columns.add('udShippedBy',		sql.VarChar(128),	{nullable: true}	);
		tvpTrx.columns.add('udShippedOn', 		sql.VarChar(19),	{nullable: true}	);
		tvpTrx.columns.add('udShippedMemo', 	sql.VarChar(120),	{nullable: true}	);
		tvpTrx.columns.add('udReceivedBy',		sql.VarChar(128),	{nullable: true}	);
		tvpTrx.columns.add('udReceivedOn', 		sql.VarChar(19),	{nullable: true}	);
		tvpTrx.columns.add('udReceivedMemo', 	sql.VarChar(120),	{nullable: true}	);
		tvpTrx.columns.add('udShipMethod', 		sql.VarChar(30),	{nullable: true}	);
		tvpTrx.columns.add('udMarkDownYN',		sql.Char(1),		{nullable: true}	);

		// Create TVP for EM Location History Parts
		const tvpParts = new sql.Table();
		tvpParts.columns.add('KeyID', 			sql.BigInt,			{nullable: false}	);
		tvpParts.columns.add('EMCo',			sql.TinyInt,		{nullable: false}	);
		tvpParts.columns.add('Equipment',		sql.VarChar(10), 	{nullable: false}	);
		tvpParts.columns.add('Sequence', 		sql.BigInt,			{nullable: false}	);
		tvpParts.columns.add('PartNo', 			sql.VarChar(30),	{nullable: false}	);
		tvpParts.columns.add('ShippedBy',		sql.VarChar(128),	{nullable: true}	);
		tvpParts.columns.add('ShippedOn', 		sql.VarChar(19),	{nullable: true}	);
		tvpParts.columns.add('ShippedMemo', 	sql.VarChar(120),	{nullable: true}	);
		tvpParts.columns.add('ReceivedBy',		sql.VarChar(128),	{nullable: true}	);
		tvpParts.columns.add('ReceivedOn', 		sql.VarChar(19),	{nullable: true}	);
		tvpParts.columns.add('ReceivedMemo', 	sql.VarChar(120),	{nullable: true}	);
		tvpParts.columns.add('Notes', 			sql.VarChar(4000),	{nullable: true}	);

		// Copy data from tx into tvpTrx
		tvpTrx.rows.add(
			(tx._id || '').substring(6,20),
			tx.EMCo				|| 0,
			tx.Equipment		|| 'fake',
			Number(tx.Sequence)	|| 0,
			this.dateFormat(tx.DateTimeIn, 'yyyy-MM-dd 00:00:00'),
			this.dateFormat(tx.DateTimeIn, 'HH:mm:ss'),	//TimeIn
			tx.ToJCCo			|| null,
			tx.ToJob			|| null,
			tx.ToLocation		|| null,
			tx.Memo				|| null,
			null,
			this.dateFormat(tx.DateTimeIn, 'yyyy-MM-dd HH:mm:ss'),
			tx.Notes			|| null,
			tx.CreatedBy		|| 'Nobody',
			this.dateFormat(tx.CreatedDate, 'yyyy-MM-dd HH:mm:ss.SSS'),
			tx.ModifiedBy		|| null,
			this.dateFormat(tx.MODDED_DATETIME, 'yyyy-MM-dd HH:mm:ss.SSS'),
			tx.udShippedBy		|| null,
			this.dateFormat(tx.udShippedOn, 'yyyy-MM-dd HH:mm:ss'), // might be null
			tx.udShippedMemo 	|| null,
			tx.udReceivedBy		|| null,
			this.dateFormat(tx.udReceivedOn, 'yyyy-MM-dd HH:mm:ss'), // might be null
			tx.udReceivedMemo	|| null,
			tx.udShipMethod		|| null,
			tx.udMarkDownYN		|| null
		);

		// Copy data from tx.PartTransfers into table variable to send to stored procedure
		var numParts = typeof tx.PartTransfers !== 'undefined'? tx.PartTransfers.length : 0;
		for(var i = 0; i < numParts; i++ )
		{
			tvpParts.rows.add(
				0,
				tx.EMCo,
				tx.Equipment,
				Number(tx.Sequence),
				tx.PartTransfers[i].PartNo.substring(0,29),
				(tx.PartTransfers[i].ShippedBy		|| null),
				this.dateFormat(tx.PartTransfers[i].ShippedOn, 'yyyy-MM-dd HH:mm:ss'), // might be null
				(tx.PartTransfers[i].ShippedMemo	|| null),
				(tx.PartTransfers[i].ReceivedBy		|| null),
				this.dateFormat(tx.PartTransfers[i].ReceivedOn, 'yyyy-MM-dd HH:mm:ss'), // might be null
				(tx.PartTransfers[i].ReceivedMemo	|| null),
				(tx.PartTransfers[i].Notes			|| null)
			);
		}

		return poolPromise.then((pool) => pool.request()
			.input('isDelete'		,isDelete? 'Y' : 'N')
			.input('emTRX'			,tvpTrx)
			.input('emPartTRX'		,tvpParts)
			.output('curChangeNum'	,sql.BigInt			,0)
			.output('rcode'			,sql.Int			,0)
			.output('ReturnMessage'	,sql.VarChar(255)	,'')
			.execute('mmspUpsertEMLocationHistory_2')
		)
	}

	_getChangeTrackingCurrentVersion() {
		return poolPromise.then((pool) => pool.request().query('SELECT CHANGE_TRACKING_CURRENT_VERSION() AS ctnum'))
		.then(r => { return r.recordset[0].ctnum });
	}

	_composeResult(freshSaved,body) {
		return {
			sent: body,
			onServer: freshSaved || []
		};
	}

	_genFakeInsertDeletes(req) {
		var updates = req.body.updated || [];
		var deletes = req.body.deleted || [];
		var results = [];

		// For each of the 'updates', send it back, removing the 'UNSYNCED' field.
		updates.forEach(function(change){
			delete change.UNSYNCED;
			delete change.$loki;
			delete change.meta;
			results.push(Object.assign({},change,{_id:change._id.replace('emtrx-N','emtrx-XX')}));
		});

		// For each of the 'deletes', create shell documents with DELETED:1, and pretty much no other fields. :-)
		deletes.forEach(function(id){
			results.push({
				_id		: id,
				DELETED	: 1
			});
		});

		return this._composeResult(results,req.body);
	}

	_genFakeTrx() {
    return {
      Category: "T-FAKE99",
      CreatedBy: "CORP\\fakeguy",
      CreatedDate: "2017-12-15T22:25:49.362Z",
      DateIn: "2017-12-16",
      DateTimeIn: "2017-12-16T14:00:00.000Z",
      Description: "MM APP TESTING TOOL FOR GUI",
      EMCo: 1,
      EQStatus: "A",
      Equipment: 'fakeEQ99',
      EstOut: null,
      FromJCCo: 1,
      FromJob: 'OTHRJB1',
      FromJobDesc: 'SEATTLE SCI-FI',
      FromLocation: null,
      FromLocationDesc: null,
      MODDED_DATETIME: "2017-12-15T22:25:49.363Z",
      Memo: 'AUTOMATED TEST',
      ModifiedBy: "CORP\\fakeguy",
      Notes: null,
      PartNotes: null,
      PartTransfers: [],
      Sequence: -400,
      Source: "(#IM) YOUR IMMAGINATION",
      ToJCCo: 1,
      ToJob: " WHWW.",
      ToJobDesc: "THE BEST JOB TO TEST",
      ToLocation: null,
      ToLocationDesc: null,
      udMarkDownYN: "N",
      udReceivedBy: "CORP\\fakeguy",
      udReceivedMemo: null,
      udReceivedOn: "2017-12-15T22:25:49.363Z",
      udShipMethod: "Deliver to Job on",
      udShippedBy: "CORP\\fakeguy",
      udShippedMemo: null,
      udShippedOn: "2017-12-15T22:25:49.363Z",
      _id: "emtrx-NTEST_99"
    }
	}
}
