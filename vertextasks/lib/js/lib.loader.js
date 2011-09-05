
function lib_load(scripts) {
  for (var i=0; i < scripts.length; i++) {
    document.write('<script src="'+scripts[i]+'"><\/script>')
  };
};

lib_load([
  "js/vertexio.js",
]);