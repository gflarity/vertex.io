var db_proxy = require('./proxy.js');
var cradle = require('cradle');
var util = require('util');
var config = require('../etc/config.js');

var usage_db = new(cradle.Connection)({
    auth: { username: config.couchDBUsername, password: config.couchDBPassword }
}).database(config.clientUsageDB);

module.exports.usage = {};

module.exports.out_data_handler = function(data, db) {
    if ((db === undefined) || (data === undefined)) return;
    
    if (! module.exports.usage.hasOwnProperty(db)) {
        module.exports.usage[db] = { in: 0, out: 0};
    }
    module.exports.usage[db].out += parseInt(data, 10) / 1024;
}

module.exports.in_data_handler = function(data, db) {
    if ((db === undefined) || (data === undefined)) return;
    
    if (! module.exports.usage.hasOwnProperty(db)) {
        module.exports.usage[db] = { in: 0, out: 0};
    }
    module.exports.usage[db].in += parseInt(data, 10) / 1024;

}

module.exports.record_usage = function() {
    
    // get all dbs for which there is currently usage
    var dbs = Object.getOwnPropertyNames(module.exports.usage);
    
    // if we have no usage information don't record
    if (dbs.length < 1) return;
    
    // get timestamp
    var now = (new Date()).getTime();
    
    var report_json = {};
    
    // log the usage
    
    //module.exports.usage.timestamp = now;
    report_json.timestamp = now;
    report_json.data = module.exports.usage;
    util.log(JSON.stringify(report_json));
    
    usage_db.save('report_' + now, report_json, function (err, res) {
        if (err) {
            util.log("Unable to write usage report:\n" + JSON.stringify(err));
            return;
        }
        
        // Handle response
        if (res.ok) {
            util.log('report sent, usage reset.');
            module.exports.usage = {};
        }
        else {
            util.log("Unexpected response writing usage report:\n" + JSON.stringify(res))
        }
    });
        
}