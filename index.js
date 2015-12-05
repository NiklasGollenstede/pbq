(function(exports) { 'use strict';

function exportLazy(key) {
	Object.defineProperty(exports, key, {
		enumerable: true,
		configurable: true,
		get: function() {
			const value = require('es6lib/'+ key);
			Object.defineProperty(exports, key, {
				enumerable: true,
				configurable: false,
				writable: false,
				value: value,
			});
			return value;
		},
	});
}

[
	'concurrent',
	'dom',
	'format',
	'functional',
	'fs',
	'graph',
	'namespace',
	'network',
	'object',
	'polyfill',
	'process',
	'template',
].forEach(exportLazy);

const moduleName = 'es6lib'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
