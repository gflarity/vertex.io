var cradle = require('cradle');
var config = require('../etc/config.js');
var util = require('util');
var sechash = require('sechash');

var user_db = new(cradle.Connection)({
    auth: { username: config.couchDBUsername, password: config.couchDBPassword }
}).database(config.userDB);

module.exports.authenticate = function(req, res, next) {

    /* Validate requests based on API key given to developer 
        developer gets username:password combo for their own Basic Auth usage
        developer gets API_KEY which is associated with their username
        
        we create a username:password combination with same permissions (by role) as developer
        BUT with an easy to generate password 
        
        CURRENTLY: user creation datetime + salt (config) + iterations (config)
        
        NOTE: I used creation datetime incase at some point we allow developers to change their
        username, which would require re-creating all the Vertex.IO shadow users...
        
        if an API key is provided we will place the needed Basic Auth (for the user associated
        with that key) for the request to succeed
        HOWEVER: if an API key is provided we must prohibit backend related modifications such as:
            i) PUT/DELETE/COPY of design documents (i.e. uri contains _design)
            ii) any _* functions
            
        NOTE: this is now done by the 'filter' middleware provided by this module
    */
    
    var api_key = req.query.api_key;
    
    // key is undefined... they better have specified auth themselves...
    if ( api_key !== undefined) {
        
        // remove api_key from current query parameters
        // it does not need to be passed to CouchDB
        delete req.query.api_key;
        
        // key was provided, get Basic Auth username/password
        // Q: does any of the username/password stuff get echoed back with Basic Auth?
        /*
        steps:
        
        i) search on vio_users database using api key view where key=<api_key>
            if no resulting documents: ERROR Invalid API_KEY
            else: get document
        */
        user_db.view('api_keys/all', { 'key': api_key }, function (err, result) {
            
            // if there was an error accessing this view, return 500 response to client
            if (err) {
                util.log("Error accessing api_key view:\n" + err);
                res.send({error: 'Server side error validating API key.'}, 500);
                return;
            }
            
            // this means there is ONE match for this api key
            if (result.length == 1) {
                
                // user doc is the value of the (only) row
                var user_doc = result[0].value;
                
                // ii) from document extract creation time and username
                // iii) using configured salt and iterations generate hash
                var api_username = 'vio_' + user_doc._id;
                var hash = sechash.strongHashSync('sha1', user_doc.creation_date, config.salt, config.iterations);
                var entries = hash.split(':');
                var api_password = entries[entries.length -1];

                // iv) basic auth username/password is vio_<username>/<hash>
                req.vio_auth = 'Basic ' + new Buffer(api_username+':'+api_password).toString('base64');
                
                util.log("validated api key, adding auth.");

                next();
                return;
            }
            else if (result.length == 0) {
                res.send({error: 'Invalid API key.'}, 400);
                return;
            }
            else {
                util.log("too many API_KEY matches:\n" + JSON.stringify(result));
                res.send({error: 'Server side error validating API key.'}, 500);
                return;
            }
        });

    }
    else {
        next();
        return;
    }
    
};

module.exports.filter = function(req, res, next) {
    // NOTE: need to prevent endless creation of databases even with dev auth
    
    var target = "/" + ((req.params[0] === undefined) ? '' : req.params[0]);
    
    // less filtering on requests without API key auth
    if (req.vio_auth === undefined) {
        next();
        return;
    }
    
    // prevent database deletion
    
    // prevent design doc modifications
    if (target.match(/_design/) !== null) {
        if ((req.method == 'PUT') || 
            (req.method == 'DELETE') ||
            (req.method == 'COPY')) {
                util.log("attempt to modify design doc with api key.");
                res.send({error: 'API key access prohibited.'}, 400);
                return;
            }
        else {
            // other operations are allowed
            next();
            return;
        }
    }
    
    // prevent _utils access
    // need to fix this as it currently blocks _all_dbs and _all_docs
    // which we eventually want to support (I think?)
    if (target.match(/\/_(.*)$/) !== null) {
        util.log("attempt to access _* function with api key.");
        res.send({error: 'API key access prohibited.'}, 400);
        return;
    }
    
    // if no filtering is done, just proceed
    next();
    return;
    
}