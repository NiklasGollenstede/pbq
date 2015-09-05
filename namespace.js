(function(exports) { 'use strict';

const NameSpace = exports.NameSpace = function NameSpace() {
	const map = new WeakMap();
	return function(key) {
		let value = map.get(key);
		if (value === undefined) {
			map.set(key, value = { });
		}
		return value;
	};
};

const IterableNameSpace = exports.IterableNameSpace = function IterableNameSpace() {
	const map = new Map();
	return Object.assign(function(key) {
		let value = map.get(key);
		if (value === undefined) {
			map.set(key, value = { });
		}
		return value;
	}, {
		forEach: map.forEach.bind(map),
		destroy: map.clear.bind(map),
	});
};

const Marker = exports.Marker = function Marker() {
	const map = new WeakMap();
	return function(key, now) {
		const old = map.get(key);
		arguments.length > 1 && map.set(key, now);
		return old;
	};
};

const moduleName = 'es6lib/namespace'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
