(() => { 'use strict'; const factory = function es6lib(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

function exportLazy(key) {
	var value;
	Object.defineProperty(exports, key, {
		enumerable: true,
		configurable: true,
		get: function() {
			!value && (value = require('./'+ key));
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

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exports = { }, result = factory(exports) || exports; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { window[factory.name] = result; } } })();
