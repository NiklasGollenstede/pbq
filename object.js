(() => { 'use strict'; const factory = function es6lib_object(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Deeply freezes an object structure by crawling the objects enumerable own properties (Object.keys()).
 * Can handles cyclic structures.
 * @param  {object}  object  An object that is part of the structure to freeze.
 * @return {object}          The object passed in.
 */
const deepFreeze = exports.deepFreeze = function deepFreeze(object) {
	const done = new WeakSet;
	(function doIt(object) {
		if (typeof object !== 'object' || object === null || done.has(object)) { return; }
		done.add(object);
		Object.freeze(object);
		Object.keys(object).forEach(function(key) { doIt(object[key]); });
	})(object);
	return object;
};

/**
 * Checks the type of build in objects, e.g. 'Object', 'Date', 'Array', ...
 * @param  {object}  object           Object to check
 * @param  {string}  constructorName  Name of the (native) constructor Function
 * @return {bool}                     true, if object is instance of the constructor
 */
const checkNativeType = exports.checkNativeType = function checkNativeType(object, constructorName) {
	return Object.prototype.toString.call(object).indexOf(constructorName, 8) === 8;
};

/**
 * Deeply copies the enumerable own property values from one object to an other.
 * If a property is an object of a not build-in type (i.e. not a Date, Window, Element, etc.),
 * it's properties will recursively copied to ether the existing property value on target
 * or an new object (or Array if the source property is an Array).
 * Build-in types will not be cloned but simply assigned to the clone.
 * Can NOT handle cyclic structures (of none-native objects).
 * @return {object}          target
 */
const copyProperties = exports.copyProperties = function copyProperties(target, source) {
	source != null && Object.keys(source).forEach(function(key) {
		let to = target[key]; const value = source[key];
		if (typeof to !== 'object') {
			target[key] = value;
		} else if (checkNativeType(value, "Object")) {
			to == null && (to = target[key] = { });
			copyProperties(to, value);
		} else if (Array.isArray(value)) {
			to == null && (to = target[key] = [ ]);
			copyProperties(to, value);
		} else {
			target[key] = value;
		}
	});
	return target;
};

/**
 * Same as copyProperties but can handle cyclic structures.
 */
const cloneOnto = exports.cloneOnto = function cloneOnto(target, source) {
	const done = new WeakMap([ [ source, target, ], ]);
	source && (function doIt(target, source) {
		Object.keys(source).forEach(function(key) {
			const sourceValue = source[key];
			if (checkNativeType(sourceValue, "Object")) {
				const targetValue = done.get(sourceValue);
				if (targetValue) {
					target[key] = targetValue;
				} else {
					!target[key] && (target[key] = { });
					doIt(target[key], sourceValue);
				}
			} else if (Array.isArray(sourceValue)) {
				const targetValue = done.get(sourceValue);
				if (targetValue) {
					target[key] = targetValue;
				} else {
					!target[key] && (target[key] = [ ]);
					doIt(target[key], sourceValue);
				}
			} else {
				target[key] = sourceValue;
			}
		});
	})(target, source);
	return target;
};

/**
 * Same as copyProperties except that assignments will fail silently, instead of throwing.
 */
const tryCopyProperties = exports.tryCopyProperties = function tryCopyProperties(target, source) {
	source && Object.keys(source).forEach(function(key) {
		if (checkNativeType(source[key], "Object")) {
			try { !target[key] && (target[key] = { }); } catch (e) { }
			tryCopyProperties(target[key], source[key]);
		} else if (Array.isArray(source[key])) {
			try { !target[key] && (target[key] = { }); } catch (e) { }
			tryCopyProperties(target[key], source[key]);
		} else {
			try { target[key] = source[key]; } catch (e) { }
		}
	});
	return target;
};

/**
 * Set 'value' as enumerable but unconfigurable and unwritable property 'key' of 'object'.
 * @return {object}   The value that was set.
 */
const setConst = exports.setConst = function setConst(object, key, value) {
	Object.defineProperty(object, key, { value: value, enumerable: true, });
	return value;
};

/**
 * Set 'value' as unenumerable but configurable and writable property 'key' of 'object'.
 * @return {object}   The value that was set.
 */
const setHidden = exports.setHidden = function setHidden(object, key, value) {
	Object.defineProperty(object, key, { value: value, configurable: true, writable: true, });
	return value;
};

/**
 * Set 'value' as unenumerable, unconfigurable and unwritable property 'key' of 'object'.
 * @return {object}   The value that was set.
 */
const setHiddenConst = exports.setHiddenConst = function setHiddenConst(object, key, value) {
	Object.defineProperty(object, key, { value: value, });
	return value;
};

/**
 * Copies the complete descriptors of the enumerable own properties from one object to an other.
 * @return {object}      The target object.
 */
const assignDescriptors = exports.assignDescriptors = function(to, from) {
	Object.keys(from).forEach(function(key) {
		Object.defineProperty(to, key, Object.getOwnPropertyDescriptor(from, key));
	});
	return to;
};

/**
 * Returns a Map where all the values are Sets, so that the map is effectively a multi map.
 * @param  {class}  MapType  The map type the MultiMap is derived from. (Map or WeakMap).
 * @return {class}           A MultiMap constructor.
 */
const MultiMapOf = MapType => class extends MapType {
	/**
	 * Creates a new MiltiMap.
	 * @param  {iterable}  init  Same as the Map constructor argument, only that the values must be iterable.
	 */
	constructor(init) {
		super();
		if (init == null) { return; }
		for (let [ key, value, ] of init) {
			super.set(key, new Set(value));
		}
	}

	/**
	 * Removes all existing values in a key range and puts 'value' as in that range.
	 * @param {any}  key    Any key the parent map accepts.
	 * @param {any}  value  Any value.
	 */
	set(key, value) {
		let set = this.get(key);
		set.clear();
		set.add(value);
	}

	/**
	 * Adds 'value' to the range of 'key' and creates the key range if it does not exist yet.
	 * @param {any}  key    Any key the parent map accepts.
	 * @param {any}  value  Any value.
	 */
	add(key, value) {
		let set = this.get(key);
		set.add(value);
	}

	/**
	 * Retrieves a mutable key range.
	 * @param  {any}  key    Any key the parent map accepts.
	 * @return {Set}         The key range. Changing the values in this Set will influence the MultiMap.
	 */
	get(key) {
		let set = super.get(key);
		if (!set) {
			set = new Set;
			super.set(key, set);
		}
		return set;
	}

	/**
	 * Removes values from a key range.
	 * @param  {any}      key    Any key the parent map accepts.
	 * @param  {any}      value  Optional. If provided, only this one value is removed from the range (if present), otherwise the entire range is cleared.
	 * @return {natural}         The number of elements removed from the range.
	 */
	delete(key, value) {
		const set = super.get(key);
		if (!set) { return 0; }
		if (arguments.length < 2) {
			const size = set.size;
			set.clear();
			return size;
		}
		return +set.delete(value);
	}
};
const MultiMap = exports.MultiMap = MultiMapOf(Map);
const WeakMultiMap = exports.WeakMultiMap = MultiMapOf(WeakMap);

const ClassMap = new WeakMap;

const ClassPrivate = {

	getSuper: function(extend) {
		if (!extend) { return; }
		if (typeof extend === 'function') {
			this.extendMode = '__proto__';
			return this.super = extend;
		}
		const _this = this;
		if (![ 'public', 'protected', 'private', ].some(function(mode) {
			_this.extendMode = mode;
			_this.super = ClassMap.get(extend[mode]);
			return true;
		})) {
			this.extendMode = '';
		}
	},

	getNameSpaces: function() {
		const _super = this.super;
		this.hasPublic = !!this.getPublic || this.extendMode === 'public' && (_super.hasPublic) || this.extendMode === '__proto__' ;
		this.hasProtected = !!this.getProtected || this.extendMode === 'protected' && (_super.hasPublic || _super.hasProtected) || this.extendMode === 'public' && (_super.hasProtected);
		this.hasPrivate = !!this.getPrivate || this.extendMode === 'private' && (_super.hasPublic || _super.hasProtected);
		this.Public = this.hasProtected || this.hasPrivate ?  new NameSpace : idFunction;
		this.Protected = this.hasProtected ?  new NameSpace : idFunction;
		this.Private = this.hasPrivate ?  new NameSpace : idFunction;
	},

	getMethods: function() {
		this.public = this.getPublic && copyPublicProperties({ }, this.getPublic(this.Private, this.Protected, this.Public), this.const) || { };
		this.protected = this.getProtected && this.getProtected(this.Private, this.Protected, this.Public);
		this.private = this.getPrivate && this.getPrivate(this.Private, this.Protected, this.Public);
		switch (this.extendMode) {
			case 'private': {
				this.private = assignDescriptors(this.private || { }, this.super.asProtected());
			} break;
			case 'protected': {
				this.protected = assignDescriptors(this.protected || { }, this.super.asProtected());
			} break;
			case 'public': {
				this.public = copyPublicProperties(Object.create(this.super.public), this.public, this.const);
				this.protected = assignDescriptors(this.protected || { }, this.super.protected);
			} break;
			case '__proto__': {
				this.public = copyPublicProperties(Object.create(this.super.prototype), this.public, this.const);
			} break;
		}
	},

	asProtected: function() {
		if (this._asProtected) { return this._asProtected; }
		const patent = this.super ? this.super.asProtected() : { };
		return this._asProtected = assignDescriptors(assignDescriptors(parent, this.protected), this.public);
	},

	getConstructorFor: function(_Protected, _Public) {
		const constructor = this.constructor, _private = this.private || Object.prototype, _protected = this.protected || Object.prototype;
		const Public = this.Public, Protected = this.Protected, Private = this.Private;
		return function() {
			const __private = Object.create(_private);
			const __protected = _Protected ? _Protected(this, Object.create(_protected)) : __private;
			const __public = _Public ? this : __protected;
			Public(__protected, __public); Public(__private, __public);
			Protected(__public, __protected); Protected(__private, __protected);
			Private(__public, __private); Private(__protected, __private);
			const ret = constructor.apply(__public, arguments);
			return typeof ret === 'object' ? ret : __public;
		};
	},

	getConstructor: function(constructor) {
		switch (this.extendMode) {
			case 'private': {
				this.Super = this.super.getConstructorFor();
			} break;
			case 'protected': {
				this.Super = this.super.getConstructorFor(this.Protected);
			} break;
			case 'public': {
				this.Super = this.super.getConstructorFor(this.Protected, this.Public);
			} break;
			case '__proto__': {
				this.Super = this.super;
			} break;
			default: {
				this.Super = idFunction;
			}
		}
		this.constructor = constructor(this.Super, this.Private, this.Protected, this.Public);
		const Constructor = this.Constructor = this.getConstructorFor(this.Protected, this.Public);
		// Constructor.class = this; // TODO: remove

		Constructor.prototype = copyPublicProperties(this.public, { _constructor: Constructor, }, this.const);
		/*Object.defineProperty(Constructor, 'prototype', {
			configurable: this.const,
			enumerable: false,
		});*/
		this.const === 'freeze' && Object.freeze(this.public);
		this.static && copyPublicProperties(Constructor, this.static, this.const);
		this.const === 'freeze' && Object.freeze(Constructor);
	},

};

const Class = exports.Class = function Class(options) {
	if (!options.hasOwnProperty('constructor')) { throw new Error('options.constructor is not defined'); }
	const self = Object.create(ClassPrivate);
	self.const = options.const == null ? true : !!options.const;
	self.static = Object.freeze(options.static);

	self.getPublic = options.public;
	self.getPrivate = options.private;
	self.getProtected = options.protected;

	self.getSuper(options.extends);

	self.getNameSpaces();
	self.getMethods();
	self.getConstructor(options.constructor);

	ClassMap.set(self.Constructor, self);
	return self.Constructor;
};

function copyPublicProperties(to, from, configurable) {
	Object.keys(from).forEach(function(key) {
		const enumerable = !(/^_/).test(key);
		const descriptor = Object.getOwnPropertyDescriptor(from, key);
		descriptor.configurable = configurable;
		descriptor.enumerable = enumerable;
		!descriptor.get && !descriptor.set && (descriptor.writable = configurable);
		Object.defineProperty(to, key.slice(!enumerable), descriptor);
	});
	return to;
}

function NameSpace(proto) {
	typeof proto === 'object' || (proto = Object.prototype);
	const map = new WeakMap();
	return function(key, set) {
		var value = map.get(key);
		if (value === undefined) {
			map.set(key, value = set || Object.create(proto));
		}
		return value;
	};
}

function idFunction(arg) { return arg; }

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exports = { }, result = factory(exports) || exports; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { window[factory.name] = result; } } })();
