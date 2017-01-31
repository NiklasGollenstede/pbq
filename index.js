(function(global) { 'use strict'; const factory = function es6lib(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

const req = arguments.length > 1 ? arguments[1] : require;

function exportLazy(key) {
	let value;
	Object.defineProperty(exports, key, {
		enumerable: true,
		configurable: true,
		get: function() {
			!value && (value = req('./'+ key));
			!Object.isSealed(exports) && Object.defineProperty(exports, key, {
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
	'functional',
	'fs',
	'namespace',
	'network',
	'object',
	'polyfill',
	'port',
	'process',
	'string',
	'template',
].forEach(exportLazy);

// NOTE: if loaded via AMD, this needs require
}; if (typeof define === 'function' && define.amd) { define([ 'exports', 'require', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { global[factory.name] = result; } } })((function() { return this; })()); // eslint-disable-line

