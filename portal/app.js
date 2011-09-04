
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var fs = require('fs');
var util = require('util');
var querystring = require('querystring');
var cradle = require('cradle');
var check = require('validator').check;

var config = require('./etc/config.js');

/* our libraries */
var db_proxy = require('./lib/proxy.js');
var usage = require('./lib/usage.js');
var api = require('./lib/api.js');

// Google Analytics
var analyticssiteid = "UA-11049829-6";
var usage_interval = 0;

// DEMO APPS path
var APPS_HOME = '/Users/Steve/dev/secretproj/vertex.io/restapp/sandbox';

// signups database
var db = new(cradle.Connection)({
    auth: { username: config.couchDBUsername, password: config.couchDBPassword }
}).database(config.clientSignupDB);

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  
  // WARNING: uncommenting bodyParser and methodOverride will BREAK the proxy
  //app.use(express.bodyParser());
  //app.use(express.methodOverride());
  //app.use(express.cookieParser());
  
  app.use(express.static(__dirname + '/public'));
  app.use(app.router);
});

app.configure('development', function(){
    util.log("development mode");
    usage_interval = 10000; // every 10 seconds
    //app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
    util.log("production mode");
    usage_interval = 1000*60*60; // every hour
    //app.use(express.errorHandler()); 
});

// Setup the errors
// TODO: define within configure() blocks to provide
// introspection when in the development environment
app.error(function(err, req, res, next){
  if (err instanceof NotFound) {
    res.render('404', { 
      status: 404, 
      title: 'Not Found',
      error: err,
      layout: 'layouts/error',
      analyticssiteid: analyticssiteid
    });
  } else {
    next(err);
  }
});

app.error(function(err, req, res){
  util.log(err);
  res.render('500', { 
    status: 500, 
    title: 'The Server Encountered an Error',
    error: err,
    layout: 'layouts/error',
    analyticssiteid: analyticssiteid
  });
});

// Routes

app.get('/', function(req, res) {
  
  return res.render('home/index', {
    title: 'Vertex.IO',
    layout: 'layouts/home',
    analyticssiteid: analyticssiteid
    // TODO: set this as default layout, instead of ./layout
  });
});

/* NOTE: this uses middleware here instead of as 'use' statements
to avoid breaking the db proxy */
app.post('/invitation/request', express.bodyParser(), function(req, res) {
  
  var email = req.body.email;
  var rets = {
   success: false,
   errors: []
  };
  
  // check if hidden field filled in by bot
  var confuca = req.body.confuca;
  if (confuca.length > 0) {
    rets.errors.push("You're a bot! :o");
    res.send(rets);
    return;
  }
  
  // get users ip address
  var ip_address = null, user_agent = null;
  ip_address = req.connection.remoteAddress;
  user_agent = req.headers['user-agent'];
  
  try {
   check(email).len(6, 64).isEmail();

   //TODO: add better email check

   // check if email already exists in db
   db.get(email, function(err, doc) {
     if (doc) {
       // already exists
       rets.success = true;
       rets.repeat = true;
       res.send(rets);
     } else {
       // save it
       db.save(email, {
         ip_address: ip_address,
         user_agent: user_agent
       }, function (err, dbRes) {
         if (err) {
            // Handle error
            rets.success = false;
          } else {
            // Handle success
            rets.success = true;
          }
          res.send(rets);
        });
     }
   });
  } catch (err) {
   rets.errors.push("Please enter a <span>valid</span> email.");
   rets.success = false; //not necessary
   res.send(rets);
  }
});

/*
DEMO endpoints
*/

app.get('/login', function(req, res){
    
    var apps = [];
    var entries = fs.readdirSync(APPS_HOME);
    for (var i = 0; i < entries.length; i++ ) {
        name = entries[i];
        //console.log(name);
        var full_path = APPS_HOME + '/' + name;
        var stats = fs.statSync(  full_path );
        if ( stats.isDirectory() ) {
            apps.push(name);
        }
    } 
    
  res.render('account', {
    locals : { 'myapps' : apps},
    layout: 'layouts/user',
    title: 'Vertex.IO',
    analyticssiteid: analyticssiteid
  });
});

app.get('/create', function(req, res){

    var client = http.createClient(3001, 'localhost'); 
    
    client.addListener('error', function(connectionException){
        if (connectionException.errno === process.ECONNREFUSED) {
            console.log('ECONNREFUSED: connection refused to '
                +client.host
                +':'
                +client.port);
        } else {
            console.log(connectionException);
        }
    });
    
    //console.log('/?' + req.param('command') + '&' + req.param('args'));
    var request = client.request("GET", '/?command=' + req.param('command') + '&args=sandbox/' + req.param('args'));
    
    request.addListener('response', function(response) {
        
        var responseBody = "";

        response.addListener("data", function(chunk) {
            responseBody += chunk;
        });

        response.addListener("end", function() {
            console.log(responseBody)
            var response_json = JSON.parse(responseBody);
            var returncode = parseInt(response_json.returncode, 10);
            console.log(response_json.output + '\n' + response_json.error);
            if (returncode == 0)
                res.redirect('http://localhost:3000/');
            else
                res.redirect('/login');
        });
    });

    request.end();
    
});

/* 
Vertex.IO API endpoints
*/

app.get('/api/v1/:username/_utils*?', function(req, res) {

    var username = req.params.username;
    var uri = req.params[0] || '';

    //TODO cleanup this regex as much as possible
    var utils_regex = /^\/?([\w|\.]*)\/?([\w|\.|\-]*)/;       
    if ( utils_regex.test( uri ) ) {    
        
        var match_results = uri.match( utils_regex );
        //console.log(match_results);
        if ( match_results[1] === '' ) {
            
            if ( uri === '/' ) {
                return res.sendfile( 'futon/index.html' );
                
            }
            else {
                //TODO this should be which ever user's specific db eventually
                return res.redirect( '/api/v1/' + username + '/_utils/' );
            }
        }
        else if ( match_results[1] !== '' ) {
            
            var path =  match_results[2] === '' 
                ? 'futon/' +  match_results[1] 
                : 'futon/' +  match_results[1]  + '/' + match_results[2];
        
            //sendfile handles .. bullshit
            res.sendfile( path );
            return;
  
        }
    }
    
});

app.get('/api/v1/:username/?', function(req, res) {
    
    var username = req.params.username;
    res.send( { 'Vertex.io' : 'Welcome', version : '0.1', 
                couch_info: {"couchdb":"Welcome","version":"1.1.1"} } );

});

app.get('/api/v1/:username/_all_dbs', function(req, res) {


    var username = req.params.username;
    
    /* NOTE: this is convention for now... should eventually return the
    array 'databases' stored in our user documents */
    return res.send( ['testdb'] );

});

app.all('/api/v1/:username/_session', function(req, res) {

    var username = req.params.username;

    db_proxy.couchdb_proxy(undefined, '/_session', req, res,  usage.out_data_handler, 
                                                    usage.in_data_handler);

});

app.all('/api/v1/:username/_uuids', function(req, res) {

    var username = req.params.username;

    db_proxy.couchdb_proxy(undefined, '/_uuids', req, res,  usage.out_data_handler, 
                                                    usage.in_data_handler);

});

app.get('/api/v1/:username/_config/query_servers/?', function(req, res) {
    return res.send( {"javascript":"bin/couchjs share/couchdb/server/main.js"} );
});

app.get('/api/v1/:username/_config/native_query_servers/?', function(req, res) {
    return res.send( {} );
});

// stub endpoint which will append a missing '/' at the end 
// since the route '/api/v1/:id/:db*?' breaks express
app.all('/api/v1/:id/db/:db', api.authenticate, api.filter, function(req, res) {
    
    var target = "/"
    
    // full CouchDB db name is <id>_<db_name>
    var full_db_name = req.params.id + "_" + req.params.db;
    
    // formulate CouchDB uri rooted in this user's db
    var uri = "/" + full_db_name + target;
    
    // auth handled via api_key or via user themself
    var auth = req.vio_auth;
    
    var qs = querystring.stringify(req.query);
    qs = qs ? '?' + qs : '';
    
    db_proxy.couchdb_proxy(auth, uri+qs, req, res,  usage.out_data_handler, 
                                                    usage.in_data_handler);
             
});

// full endpoint
app.all('/api/v1/:id/db/:db/*?', api.authenticate, api.filter, function(req, res) {
    
    var target = "/" + ((req.params[0] === undefined) ? '' : req.params[0]);
    
    // full CouchDB db name is <id>_<db_name>
    var full_db_name = req.params.id + "_" + req.params.db;
    
    // formulate CouchDB uri rooted in this user's db
    var uri = "/" + full_db_name + target;
    
    // auth handled via api_key or via user themself
    var auth = req.vio_auth;
    
    var qs = querystring.stringify(req.query);
    qs = qs ? '?' + qs : '';
    
    util.log("\n" +
        "user: " + req.params.id + "\n" +
        "db: " + req.params.db + "\n" +
        "uri: " + uri + "\n" +
        "qs: " + qs);
    
    db_proxy.couchdb_proxy(auth, uri+qs, req, res,  usage.out_data_handler, 
                                                    usage.in_data_handler);
             
});

// The 404 Route (ALWAYS Keep this as the last route)
app.get('/*', function(req, res){
  throw new NotFound;
});

// Provide our app with the notion of NotFound exceptions
function NotFound(path){
  this.name = 'NotFound';
  if (path) {
    Error.call(this, 'Cannot find ' + path);
    this.path = path;
  } else {
    Error.call(this, 'Not Found');
  }
  Error.captureStackTrace(this, arguments.callee);
}

/**
 * Inherit from `Error.prototype`.
 */

NotFound.prototype.__proto__ = Error.prototype;

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(2999);
  util.log("Express server listening on port " + app.address().port);
  /*ssl_app.listen(443);
  util.log("Express server (SSL) listening on port " + ssl_app.address().port);*/
  
  // initialize our usage reporting
  setInterval(usage.record_usage, usage_interval);
}
