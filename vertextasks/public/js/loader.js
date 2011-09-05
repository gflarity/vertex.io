
function load(scripts) {
  for (var i=0; i < scripts.length; i++) {
    document.write('<script src="'+scripts[i]+'"><\/script>')
  };
};

load([
  "js/jquery.loader.js",
  "js/couch.loader.js",
  "js/underscore.loader.js",
  "js/lib.loader.js",
  "js/app.js"
]);
