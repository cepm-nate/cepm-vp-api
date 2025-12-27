if (!process.env.LDAP_URL) require('dotenv').config();

// sentry.io tracing
require("./instrument.js");
require("./app/utils/sentry-sql-patch"); // to add more info

const compression = require("compression");
const express = require("express"); // call express
const app = express(); // define our app using express
const cors = require('cors');
// const https = require("https");
// const fs = require("fs");
// const Emtrx = require("./app/controllers/emtrx");
// const PhyCnts = require("./app/controllers/phycnts");
// const Auth = require("./app/controllers/auth");
const bodyParser = require("body-parser");

app.use(cors({
  origin: ['https://app.cepm.biz', 'http://localhost:8080', 'https://mm.cepm.biz'],
  credentials: true,  // Enable if using auth cookies/tokens
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// app.use(allowCrossDomain);
app.use(compression());

// // Logging middleware
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
//   next();
// });

var port = process.env.PORT || 12980; // set our port

// Cross Domain
// =============================================================================
// function allowCrossDomain(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "token,username,password,Testing,x-uuid,x-phone,x-code,x-pass,x-employee,x-hqco",
//   );
//   res.header("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
//   res.header("Cache-Control", "no-cache");
//   if (req.method === 'OPTIONS') return res.status(200).send();
//   next();
// }

app.use("/api", require("./app/routes/api"));

// START THE SERVER
// =============================================================================
app.listen(port, "0.0.0.0", function () {
  console.log("CEPM-VP-API calls happen on port " + port);
});
