const express = require("express");
const router = express.Router();
const RSMeans = require("../controllers/rsmeans");
router.get("/start", async function(req,res){
  const { cookie, validationToken, year, dataReleaseId, type, quarter } = req.query;
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.setHeader("Connection","keep-alive");
  const rs = new RSMeans({
    cookie, validationToken, year, dataReleaseId, type, quarter,
    onLog: function(msg, type) {
      res.write("data: "+JSON.stringify({message:msg,type:type})+"\n\n");
    }
  });
  try {
    res.write("data: "+JSON.stringify({message:"Starting...",type:"info"})+"\n\n");
    await rs.obtainAndImport();
    res.write("data: "+JSON.stringify({message:"Done",done:true})+"\n\n");
  } catch(e){
    let msg = e.message;
    if (msg.includes("invalid json") || msg.includes("Unexpected token")) {
      msg = "Session timed out - please update your COOKIE and VALIDATION_TOKEN";
    }
    res.write("data: "+JSON.stringify({message:msg,type:"error"})+"\n\n");
  }
  res.end();
});
module.exports=router;