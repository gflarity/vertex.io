 var couchapp = require('couchapp')
  , path = require('path')
  ;

ddoc = 
  { _id:'_design/app'
  , rewrites : 
    [ {from:"/", to:'index.html'}
    , {from:"cache.manifest", to:'_show/cachemanifest'}
    , {from:"/api", to:'../../'}
    , {from:"/api/*", to:'../../*'}
    , {from:"/*", to:'*'}
    ]
  }
  ;


ddoc.shows = {};

ddoc.shows.cachemanifest = function(head, req) {
  var manifest = "";
  for (var a in this._attachments) {
    manifest += ("" + a + "\n");
  }
  
  manifest += ("/_utils/script/sha1.js\n");
  manifest += ("/_utils/script/json2.js\n");
  
  // Network: What not to cache
  manifest += ("\nNETWORK:\n");
  manifest += ("*\n");

  var r =
    { "headers": { "Content-Type": "text/cache-manifest", "Etag":this._rev}
    , "body": "CACHE MANIFEST\n" + '# rev ' + this._rev + '\n' + manifest
    }
  return r;
}

ddoc.views = {};

ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx) {   
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  } 
}

couchapp.loadAttachments(ddoc, path.join(__dirname, 'public'));
couchapp.loadAttachments(ddoc, path.join(__dirname, 'vendor/couchapp'));
couchapp.loadAttachments(ddoc, path.join(__dirname, 'vendor/jquery'));
couchapp.loadAttachments(ddoc, path.join(__dirname, 'vendor/underscore'));
couchapp.loadAttachments(ddoc, path.join(__dirname, 'lib'));

module.exports = ddoc;