(function(exports) { 'use strict';

function extend(object, key, value) {
	Object.defineProperty(object, key, {
		enumerable: false, configurable: true, writable: true,
		value: value,
	});
	return value;
}

// don't alarm static analysis by using 'Function' global
const FunctionPrototypeCall = (function() { }).call;

exports = function polyfill(subject, options) {

	if (!subject) {
		if (typeof global !== 'undefined') {
			subject = global;
		} else
		if (typeof window !== 'undefined') {
			subject = window;
		}
	}

	const String = subject.String;
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
				extend(String, name, FunctionPrototypeCall.bind(String.prototype[name]));
			}
		});
	}

	const Array = subject.Array;
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

		if (!Array.prototype.fill) {
			Array.prototype.fill = function fill(value, start, end) {
				if (this == null) { throw new TypeError('this is null or not defined'); }

				const self = Object(this);
				const length = self.length >>> 0;
				start = start >> 0;
				end === undefined && (end = length)
				|| (end = end < 0 ?
					Math.max(length + end, 0) :
					Math.min(end, length));
				var k = start < 0 ?
					Math.max(length + start, 0) :
					Math.min(start, length);
				while (k < end) {
					self[k] = value;
					++k;
				}
				return self;
			};
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
			'unshift',
		].forEach(function(name) {
			if (!Array[name] && Array.prototype[name]) {
				extend(Array, name, FunctionPrototypeCall.bind(Array.prototype[name]));
			}
		});
	}

	const Object = subject.Object;
	if (typeof Object === 'function') {

		// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
		if (!Object.assign) {
			extend(Object, 'assign', function(target/*, ...sources*/) {
				if (target == null) { throw new TypeError('can\'t convert null to object'); }

				target = Object(target);
				for (var i = 1; i < arguments.length; ++i) {
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

const moduleName = 'es6lib/polyfill'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
