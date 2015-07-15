'use strict';
/* global module */

function extend(object, key, value) {
	Object.defineProperty(object, key, {
		enumerable: false, configurable: true, writable: true,
		value: value,
	});
	return value;
}

module.exports = function polyfill(global, options) {

	const String = global.String;
	if (typeof String === 'function') {
		[
			'charAt',
			'charCodeAt',
			'charCodeAt',
			'concat',
			'contains',
			'endsWith',
			'includes',
			'indexOf',
			'lastIndexOf',
			'localeCompare',
			'match',
			'normalize',
			'replace',
			'search',
			'slice',
			'split',
			'startsWith',
			'substr',
			'substring',
			'toLocaleLowerCase',
			'toLocaleUpperCase',
			'toLowerCase',
			'toUpperCase',
			'trim',
			'trimLeft',
			'trimRight',
		].forEach(function(name) {
			if (!String[name] && String.prototype[name]) {
				extend(String, name, Function.prototype.call.bind(String.prototype[name]));
			}
		});
	}

	const Array = global.Array;
	if (typeof Array === 'function') {

		if (!Array.prototype.find && Array.prototype.some) {
			extend(Array.prototype, 'find', function(callback, thisArg) {
				var ret;
				if (this.some(function(item) {
					ret = item;
					return callback.apply(this, arguments);
				}, thisArg)) {
					return ret;
				}
			});
		}
		if (!Array.prototype.findIndex && Array.prototype.some) {
			extend(Array.prototype, 'findIndex', function(callback, thisArg) {
				var ret;
				if (this.some(function(item, index) {
					ret = index;
					return callback.apply(this, arguments);
				}, thisArg)) {
					return ret;
				}
				return -1;
			});
		}

		[
			'concat',
			'every',
			'filter',
			'forEach',
			'indexOf',
			'join',
			'lastIndexOf',
			'map',
			'pop',
			'push',
			'reduce',
			'reduceRight',
			'reverse',
			'shift',
			'slice',
			'some',
			'sort',
			'splice',
			'unshift	',
		].forEach(function(name) {
			if (!Array[name] && Array.prototype[name]) {
				extend(Array, name, Function.prototype.call.bind(Array.prototype[name]));
			}
		});
	}

	const Object = global.Object;
	if (typeof Object === 'function') {

		// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
		if (!Object.assign) {
			extend(Object, 'assign', function(target/*, ...sources*/) {
				if (target == null) { throw new TypeError('can\'t convert null to object'); }

				target = Object(target);
				for (var i = 1; i < arguments.length; i++) {
					if (arguments[i] == null) { continue; }
					var source = Object(arguments[i]);
					var keys = Object.keys(source);

					for (
						var index = 0,
							length = keys.length,
							key = keys[index];
						index < length;
						key = keys[++index]
					) {
						target[key] = source[key];
					}
				}
				return target;
			});
		}
	}

};
