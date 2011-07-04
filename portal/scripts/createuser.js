var path = require('path');
var cradle = require('cradle');
var config = require('../etc/config.js');
var http = require('http');
var sechash = require('sechash');
var crypto = require('crypto');
var emitter = require('events').EventEmitter

var DB_SUFFIX = 'testdb';
var DB_ROLE_SUFFIX = 'admin';
var USAGE = process.argv[0] + ' ' + path.basename(process.argv[1]) + ' <username> <password>';

// command line arguments, die if not there
var username = process.argv[2];
var password = process.argv[3];

if (username === undefined || password === undefined) {
    console.log(USAGE);
    process.exit(1);
}

var synchronizer = new emitter();

// create admin connection
var admin_c = new(cradle.Connection)({
    auth: { username: config.couchDBUsername, password: config.couchDBPassword }
});

// _users database
var user_db = admin_c.database('_users');
var vio_user_db = admin_c.database(config.userDB);

function create_vio_shadow_password(date, salt, iterations) {
    var hash = sechash.strongHashSync('sha1', date, salt, iterations);
    var entries = hash.split(':');
    return entries[entries.length -1];
}

function get_hash_and_salt(password) {
    
    var salt = sechash.basicHash('md5', String(Math.random()).substring(0, 16));
    var hashed_password = sechash.basicHash('sha1', password + salt);
    
    return hashed_password + ':' + salt;
}

// used to create a user
function create_db_user(username, password, db, time, vio_user) {
    
    var hashed = get_hash_and_salt(password).split(':');
    var _id = "org.couchdb.user:" + username;
    var user_doc = {
      "type"         : "user",
      "name"         : username,
      "roles"        : [db+'_' + DB_ROLE_SUFFIX],
      "password_sha" : hashed[0],
      "salt"         : hashed[1],
    }
    
    user_db.save(_id, user_doc, function (err, res) {
        // Handle response
        if (err !== null || res.ok === undefined) {
            console.log(err);
            console.log(res);
            process.exit(1);
        }
        
        console.log("created user '" + username +"' for " + db);
        
        // create the vio_users document
        if (vio_user === undefined) return;
        
        var api_key = sechash.basicHash('md5', String(Math.random()).substring(0, 16));
        console.log("API_KEY: " + api_key);
        
        vio_user_doc = {
            "creation_date" : time,
            "api_key": api_key
        }
        
        vio_user_db.save(username, vio_user_doc, function (err, res) {
            // Handle response
            if (err !== null || res.ok === undefined) {
                console.log(err);
                console.log(res);
                process.exit(1);
            }

            console.log("created vertex.io user '" + username +"' for " + db);
        });
    });
}

var creation_date = new Date();

// create the user database
var new_db_name = username + '_' + DB_SUFFIX;
var db = admin_c.database(new_db_name);

db.exists(function(err, exists) {
    if (exists) {
        console.log("'" + new_db_name + "' already exists, exiting.");
        process.exit(1);
    }
    else {
        db.create(function() {
            console.log("created database " + new_db_name);
            synchronizer.emit('user_db_created');
        });
    }
});

// create CouchDB database admin user
create_db_user(username, password, new_db_name, ''+creation_date, true);

// create Vertex.IO shadow user for this db
console.log(''+creation_date);
var vio_shadow_password = create_vio_shadow_password(''+creation_date, config.salt, config.iterations);
console.log("PASSWORD: " + vio_shadow_password);
create_db_user("vio_" + username, vio_shadow_password, new_db_name);

// create security document for this db
// NOTE: need to wait until the db is made
synchronizer.once('user_db_created', function() {
    var security_doc = {
      "admins" : {
         "names" : [],
         "roles" : [new_db_name+'_' + DB_ROLE_SUFFIX]
       },
       "readers" : {
         "names" : [],
         "roles" : [new_db_name+'_' + DB_ROLE_SUFFIX]
       }
    }
    db.save('_security', security_doc, function (err, res) {
        // Handle response
        
        if (err !== null || res.ok === undefined) {
            console.log(err);
            console.log(res);
            process.exit(1);
        }
        console.log("security document created.");
    });
});

//console.log("Done!");



