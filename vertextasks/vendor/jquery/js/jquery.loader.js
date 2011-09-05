
function jquery_load(scripts) {
  for (var i=0; i < scripts.length; i++) {
    document.write('<script src="'+scripts[i]+'"><\/script>')
  };
};

jquery_load([
  "js/jquery.min.js",
  "js/jquery.mobile.min.js"
]);
