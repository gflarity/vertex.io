
function couchapp_load(scripts) {
  for (var i=0; i < scripts.length; i++) {
    document.write('<script src="'+scripts[i]+'"><\/script>')
  };
};

couchapp_load([
  "js/jquery.couch.js",
  "/_utils/script/sha1.js",
  "/_utils/script/json2.js",
  "js/jquery.couch.app.js",
  "js/jquery.couch.app.util.js",
  "js/jquery.mustache.js",
  "js/jquery.evently.js"
]);
