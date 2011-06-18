
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var fs = require('fs');
var util = require('util');

var querystring = require('querystring');

var config = require('./etc/config.js');
var db_proxy = require('./lib/proxy.js');
var usage = require('./lib/usage.js');

var app = module.exports = express.createServer();
/*var ssl_app = express.createServer({
    key: fs.readFileSync('etc/server.key'),
    cert: fs.readFileSync('etc/server.crt')
});*/

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  //app.use(express.bodyParser());
  //app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

app.register('.html', require('ejs'));

// SSL Configuration
/*
ssl_app.configure(function(){
  ssl_app.use(app.router);
});

ssl_app.configure('development', function(){
  ssl_app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

ssl_app.configure('production', function(){
  ssl_app.use(express.errorHandler()); 
});*/

// Routes

app.get('/', function(req, res){
  res.render('index', {
    locals : {}
  });
});

/*
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
    
  res.render('login', {
    locals : { 'myapps' : apps}
  });
});*/

app.get('/us', function(req, res){
  res.render('us', {
    locals : {}
  });
});

app.all('/db*', function(req, res) {
    
    uri = req.params[0];
    qs = querystring.stringify(req.query);
    qs = qs ? '?' + qs : '';
    
    if (uri.match(/^\/_/)) {
        util.log("attempt to access admin URI '" + uri+qs + "' by " + req.connection.remoteAddress);
        res.redirect('/');
    }
    else if (uri.match(/^\/vio_/)) {
        util.log("attempt to access vertex.io private db '" + uri+qs + "' by " + req.connection.remoteAddress)
        res.redirect('/');
    }
    else {
        usage.in_data_handler(req, uri+qs);
        
        // for some reason /db/_utils/ works fine, but /db/_utils does not
        db_proxy.couchdb_proxy(uri+qs, req, res, usage.out_data_handler);
        return;
    }
    
});


app.get('/pricing', function(req, res){
  res.render('pricing', {
    locals : {}
  });
});

app.get('/competition', function(req, res){
  res.render('competition', {
    locals : {}
  });
});

app.get('/tech', function(req, res){
  res.render('technologies', {
    locals : {}
  });
});

app.get('/solution', function(req, res){
  res.render('solution', {
    locals : {}
  });
});

app.get('/why', function(req, res){
  res.render('why', {
    locals : {}
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

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(80);
  util.log("Express server listening on port " + app.address().port);
  /*ssl_app.listen(443);
  util.log("Express server (SSL) listening on port " + ssl_app.address().port);*/
  
  setInterval(usage.record_usage, 10000);
}
