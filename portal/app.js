
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

// Google Analytics
var analyticssiteid = "UA-11049829-6";
var usage_interval = 0;

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
  
  return res.render('index', {
    title: 'Vertex.IO',
    layout: 'layouts/app',
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

app.all('/db*', function(req, res) {
    
    uri = req.params[0];
    qs = querystring.stringify(req.query);
    qs = qs ? '?' + qs : '';
    
    if (uri.match(/^\/_/)) {
        util.log("attempt to access admin URI '" + uri+qs + "' by " + req.connection.remoteAddress);
        throw new NotFound;
    }
    else if (uri.match(/^\/vio_/)) {
        util.log("attempt to access vertex.io private db '" + uri+qs + "' by " + req.connection.remoteAddress)
        throw new NotFound;
    }
    else {
        // for some reason /db/_utils/ works fine, but /db/_utils does not
        db_proxy.couchdb_proxy(uri+qs, req, res, usage.out_data_handler, usage.in_data_handler);
        return;
    }
    
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
  app.listen(80);
  util.log("Express server listening on port " + app.address().port);
  /*ssl_app.listen(443);
  util.log("Express server (SSL) listening on port " + ssl_app.address().port);*/
  
  // initialize our usage reporting
  setInterval(usage.record_usage, usage_interval);
}
