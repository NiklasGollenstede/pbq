(function(exports) { 'use strict';

/**
 * NameSpace constructor, where a NameSpace is a function that can be used to emulate provate/namespaced oroperties on objects.
 * When called with an arbitrary object, an instance returns a shadow object associated with that particular object.
 * The shadow object can be used to store "namespaced" properties.
 * Since the NameSpace instance is the only way to obtain the shadow object, these properties are truly private.
 * @param  {object}  proto  optional __proto__ of all shadow objects.
 * @throws {TypeError} If called with non-object argument.
 */
const NameSpace = exports.NameSpace = function NameSpace(proto) {
	typeof proto === 'object' || (proto = Object.prototype);
	const map = new WeakMap();
	return function(key) {
		let value = map.get(key);
		if (value === undefined) {
			map.set(key, value = Object.create(proto));
		}
		return value;
	};
};

/**
 * IterableNameSpace, similar to NameSpace, but holds strong references to the arguments it is called with.
 * @param  {object}  proto  optional __proto__ of all shadow objects.
 * @method forEach  Iterate the internal Map.
 * @method destroy  Reset the instance and drop all references.
 * Doesn't throw if called with non-object argument.
 */
const IterableNameSpace = exports.IterableNameSpace = function IterableNameSpace(proto) {
	typeof proto === 'object' || (proto = Object.prototype);
	const map = new Map();
	return Object.assign(function(key) {
		let value = map.get(key);
		if (value === undefined) {
			map.set(key, value = Object.create(proto));
		}
		return value;
	}, {
		forEach: map.forEach.bind(map),
		destroy: map.clear.bind(map),
	});
};

/**
 * Marker, similar to NameSpace, but explicitly stores a value (2nd argument) and has Get and Set behaviour:
 * When called stores the new value to an object, but returns the value it had before that call.
 * When called without 2nd argument, it only returns the current value.
 */
const Marker = exports.Marker = function Marker() {
	const map = new WeakMap();
	return function(key, now) {
		const old = map.get(key);
		arguments.length > 1 && map.set(key, now);
		return old;
	};
};

const moduleName = 'es6lib/namespace'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
