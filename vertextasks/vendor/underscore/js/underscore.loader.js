
function underscore_loader(scripts) {
  for (var i=0; i < scripts.length; i++) {
    document.write('<script src="'+scripts[i]+'"><\/script>')
  };
};

underscore_loader([
  "js/underscore-min.js"
]);
