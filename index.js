(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	require,
	exports,
}) {

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

}); })();
