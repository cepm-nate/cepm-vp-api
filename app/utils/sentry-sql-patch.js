// utils/sentry-sql-patch.js
const Sentry = require("@sentry/node");
const sql = require('mssql');

// Configuration from environment variables
const statementDestination = process.env.SENTRY_SQL_STATEMENT_DESTINATION || 'attribute'; // 'attribute' or 'breadcrumb'
const statementPrefix = process.env.SENTRY_SQL_STATEMENT_PREFIX || 'custom'; // 'custom' or 'db'
const includeResultValues = process.env.SENTRY_SQL_INCLUDE_RESULT_VALUES !== 'false'; // defaults true
const outputValueMaxLength = parseInt(process.env.SENTRY_SQL_OUTPUT_VALUE_MAX_LENGTH, 10) || 0; // 0 means no limit

// Helper function to extract parameters into an array
function extractParams(request) {
  if (request.parameters instanceof Map) {
    return Array.from(request.parameters.values());
  } else if (Array.isArray(request.parameters)) {
    return request.parameters;
  } else if (typeof request.parameters === 'object' && request.parameters !== null) {
    return Object.values(request.parameters);
  } else {
    return [];
  }
}

// Helper function to get SQL type name for a parameter
function getSqlTypeName(p) {
  if (!p.type || !p.type.name) {
    return 'VARCHAR(MAX)'; // Default fallback
  }
  const name = p.type.name.toUpperCase();
  if (name === 'VARCHAR' || name === 'NVARCHAR' || name === 'VARBINARY') {
    return name + '(MAX)';
  } else if (name === 'DATETIME2' || name === 'TIME' || name === 'DATETIMEOFFSET') {
    return name + '(7)';
  } else if (name === 'DECIMAL') {
    return name + '(38,2)';
  } else if (name === 'NUMERIC') {
    return name + '(38,0)';
  } else if (name === 'FLOAT') {
    return name + '(53)';
  } else if (name === 'CHAR') {
    return name + '(8000)';
  } else if (name === 'NCHAR') {
    return name + '(4000)';
  } else if (name === 'BINARY') {
    return name + '(8000)';
  } else {
    return name;
  }
}

// Helper function to get value string for a parameter
function getValueStr(p) {
  if (p.value === null || p.value === undefined) {
    return 'NULL';
  } else {
    const isStringType = p.type && (p.type.name === 'VarChar' || p.type.name === 'NVarChar' || p.type.name === 'Char' || p.type.name === 'NChar' || p.type.name === 'Text' || p.type.name === 'NText');
    if (isStringType || typeof p.value === 'string') {
      return `'${p.value.toString().replace(/'/g, "''")}'`; // escape and quote
    } else {
      return p.value.toString();
    }
  }
}

// Helper function to build DECLARE statements for parameters
function buildDeclares(params) {
  return params.map(p => {
    let declare = `DECLARE @${p.name} ${getSqlTypeName(p)}`;
    if (p.io === 1) { // input
      declare += ` = ${getValueStr(p)}`;
    }
    declare += '; \n';
    return declare;
  }).join('');
}

// Helper function to ensure undefined values are null
function normalizeParams(params) {
  params.forEach(p => {
    if (p.value === undefined) p.value = null;
  });
}

// Save originals
const originalExecute = sql.Request.prototype.execute;
const originalQuery = sql.Request.prototype.query;

// Patch execute
sql.Request.prototype.execute = async function(proc, callback) {
  // Extract parameters into an array without modifying the original Map or array
  const params = extractParams(this);

  return Sentry.startSpan({
    op: 'db.sql.execute',
    name: `EXEC ${proc}`,
  }, async (span) => {
    // Ensure undefined values are null to send params
    normalizeParams(params);

    // Collect inputs and outputs
    const inputs = params.filter(p => p.io === 1);
    const outputs = params.filter(p => p.io === 2);

    // Build parameterized description
    const paramsStr = inputs.map(p => `@${p.name} = ?`).join(', ');
    const desc = paramsStr ? `EXEC ${proc} ${paramsStr}` : `EXEC ${proc}`;
    span.updateName(desc); // Update span name (description in Sentry)

    // Build executable SQL statement with declares
    const declares = buildDeclares(params);
    const inputList = inputs.map(p => `@${p.name}`).join(', ');
    const outputList = outputs.map(p => `@${p.name} OUTPUT`).join(', ');
    const paramList = [inputList, outputList].filter(s => s).join(', ');
    const execSql = `EXEC ${proc}${paramList ? ' ' + paramList : ''};`;
    const fullStatement = declares ? declares + execSql : execSql;

    // Set base attributes
    span.setAttribute('db.system', 'mssql');
    span.setAttribute('db.operation', 'execute');
    span.setAttribute('db.procedure', proc);
    // span.setAttribute('db.statement', desc);
    if (statementDestination === 'attribute' && fullStatement.length <= 2048) {
      span.setAttribute(`${statementPrefix}.sql_statement`, fullStatement);
    } else if (statementDestination === 'breadcrumb' && fullStatement.length <= 2048) {
      Sentry.addBreadcrumb({ message: 'SQL Statement', category: 'db', data: { statement: fullStatement } });
    }

    // Add input params (values included; consider masking sensitive data)
    inputs.forEach(p => {
      span.setAttribute(`db.param.${p.name}`, p.value);
      span.setAttribute(`db.param.${p.name}.type`, p.type ? p.type.name : 'unknown');
    });

    // Add output declarations
    outputs.forEach(p => {
      span.setAttribute(`db.output_decl.${p.name}`, p.type ? p.type.name : 'unknown');
    });

    try {
      const result = await originalExecute.call(this, proc, callback);

      // Add actual output values from result
            if (includeResultValues) {
              outputs.forEach(p => {
                if (result.output && result.output[p.name] !== undefined) {
                  let val = result.output[p.name];
                  if (outputValueMaxLength > 0 && typeof val === 'string' && val.length > outputValueMaxLength) {
                    val = val.substring(0, outputValueMaxLength) + '...';
                  }
                  span.setAttribute(`db.output.${p.name}`, val);
                }
              });
            }

      // Add return value and result info
      if (includeResultValues && result.returnValue !== undefined) {
        span.setAttribute('db.return_value', result.returnValue);
      }
      if (result.recordsets) {
        span.setAttribute('db.recordsets_count', result.recordsets.length);
        result.recordsets.forEach((rs, i) => {
          span.setAttribute(`db.recordset_${i}_rows`, rs.length);
        });
      }
      if (result.rowsAffected) {
        span.setAttribute('db.rows_affected', result.rowsAffected.join(', '));
      }

      return result;
    } catch (err) {
      span.setAttribute('error', true);
      Sentry.captureException(err);
      throw err;
    }
  });
};

// Patch query
sql.Request.prototype.query = async function(command, callback) {
  // Extract parameters into an array without modifying the original Map or array
  const params = extractParams(this);

  return Sentry.startSpan({
    op: 'db.sql.query',
    name: 'SQL Query',
  }, async (span) => {
    // Ensure undefined values are null to send params
    normalizeParams(params);

    // Collect inputs
    const inputs = params.filter(p => p.io === 1);

    span.updateName(command); // Update span name with the query
    span.setAttribute('db.system', 'mssql');
    span.setAttribute('db.operation', 'query');
    span.setAttribute('db.statement', command);

    // Build executable SQL statement with declares
    const declares = buildDeclares(inputs);
    const fullStatement = declares ? declares + command : command;
    if (statementDestination === 'attribute' && fullStatement.length <= 2048) {
      span.setAttribute(`${statementPrefix}.sql_statement`, fullStatement);
    } else if (statementDestination === 'breadcrumb' && fullStatement.length <= 2048) {
      Sentry.addBreadcrumb({ message: 'SQL Statement', category: 'db', data: { statement: fullStatement } });
    }

    // Add input params
    inputs.forEach(p => {
      span.setAttribute(`db.param.${p.name}`, p.value);
      span.setAttribute(`db.param.${p.name}.type`, p.type ? p.type.name : 'unknown');
    });

    try {
      const result = await originalQuery.call(this, command, callback);

      // Add result info
      if (result.recordsets) {
        span.setAttribute('db.recordsets_count', result.recordsets.length);
        result.recordsets.forEach((rs, i) => {
          span.setAttribute(`db.recordset_${i}_rows`, rs.length);
        });
      }
      if (result.rowsAffected) {
        span.setAttribute('db.rows_affected', result.rowsAffected.join(', '));
      }

      return result;
    } catch (err) {
      span.setAttribute('error', true);
      Sentry.captureException(err);
      throw err;
    }
  });
};
