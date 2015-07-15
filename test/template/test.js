"use strict";
/* global global */

var traceur = require('traceur/src/node/System.js');
global.require = require;

traceur.import('./main.js', global).then(function(module) {

	module.main();

});
