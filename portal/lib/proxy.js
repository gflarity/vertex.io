var http = require('http');
var config = require('../etc/config.js');
var util = require('util');

/* determines CouchDB database name from URI
    i.e. /<db_name>/rest/of/request
    
    returns undefined if there is none
*/
module.exports.get_db_name = function(uri) {
    var m = uri.match(/^\/(\w+)\/?/);
    var db = undefined;
    if (m) {
        db = m[1];
    }
    return db;
}

/* 
A simple proxy for CouchDB requests to a configured CouchDB host/port
    target: the desired CouchDB URI
    req : express.js request object
    res: express.js response object
    dataHandler : callback that takes proxied response Content-Length 
*/
module.exports.couchdb_proxy = function(    auth, 
                                            target, 
                                            req, 
                                            res, 
                                            outDataHandler, 
                                            inDataHandler) {
    
    // get db name if it exists in target
    var db = module.exports.get_db_name(target);
    
    // request options
    var options = {
        host : config.couchDBHost,
        port : config.couchDBPort,
        path : target,
        method : req.method,
        headers : req.headers
    };
    
    // if not undefined insert auth into our proxy headers
    if (auth !== undefined) {
        options.headers.Authorization = auth;
    }
        
    // make the desired request
    var proxy_req = http.request(options);
    
    // if we get any kind of error currently return a 500 response
    proxy_req.once('error', function(e){
        util.log('problem with proxy: ' + e.message);
        // this should send a proper 500 error...
        res.writeHead(500, "Unable to reach database.");
        res.end()
    });
    
    // create our response callback for the proxy request
    proxy_req.on('response', function(proxy_res) {
        
        var data_out = 0;
               
        // write to our response in chunks
        proxy_res.on("data", function(chunk) {
            data_out += Buffer.byteLength(''+chunk);
            res.write(chunk, 'binary');
        });

        // if we have a dataHandler callback, call it now
        // then end our response
        proxy_res.on("end", function() {
            
            if (outDataHandler !== undefined)
                outDataHandler(data_out, db);
                
            res.end();
        });
        
        res.writeHead(proxy_res.statusCode, proxy_res.headers);
    });
    
    var data_in = 0;
    
    // if we have a streaming request, write it to our
    // proxy request
    req.on('data', function(chunk) {
        data_in += Buffer.byteLength(''+chunk);
        proxy_req.write(chunk, 'binary');
    });
    
    // when we're done writing to the proxied request, end it
    req.on('end', function() {
        
        if (inDataHandler !== undefined)
            inDataHandler(data_in, db);
            
        proxy_req.end();
    });
    
    // make our proxy request
    proxy_req.end();
};