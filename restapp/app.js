
/**
 * Module dependencies.
 */

var express = require('express'),
    spawn = require('child_process').spawn;

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  
  var command = req.param('command', 'help');
  var cwd = req.param('cwd', '');
  var rest_args = req.param('args', '');
    
  var args = ['/Users/Steve/dev/secretproj/vertex.io/restapp/couchapp/Couchapp.py'];
  var options = {};
  
  args.push(command);
  
  if (rest_args)
    args = args.concat(rest_args.split(','));
  
  if (cwd)  
    options.cwd = 'sandbox/' + cwd;
    
  console.log("couchapp request:")
  console.log("args: " + args);
  console.log("cwd: " + cwd);
  
  var output = '';
  var error = '';
  couchapp = spawn('python', args, options);
  
  couchapp.stdout.on('data', function (data) {
    //console.log('stdout: ' + data);
    output += data;
  });

  couchapp.stderr.on('data', function (data) {
    //console.log('stderr: ' + data);
    error += data;
  });

  couchapp.on('exit', function (code) {
    console.log('child process exited with code ' + code);
    console.log(error);
    res.send({'output' : output, 'error': error, 'returncode' : code }, {   'Content-Type' : 'application/json', 
                                                                            'Access-Control-Allow-Origin' : '*'}, 200);
  });
  
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3001);
  console.log("Express server listening on port %d", app.address().port);
}