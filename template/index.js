(function(exports) { 'use strict';

Object.assign(exports,
	require('es6lib/template/engine'),
	{ escape: require('es6lib/template/escape'), }
);

const moduleName = 'es6lib/template'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
