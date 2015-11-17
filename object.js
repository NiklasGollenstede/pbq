(function(exports) {
'use strict';

const NameSpace = reqire('es6lib/namespace').NameSpace;

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
 * Can NOT handle cyclic structures (of none-native object).
 * @return {object}          target
 */
const copyProperties = exports.copyProperties = function copyProperties(target, source) {
	Object.keys(source).forEach(function(key) {
		if (checkNativeType(source[key], "Object")) {
			!target[key] && (target[key] = { });
			copyProperties(target[key], source[key]);
		} else if (Array.isArray(source[key])) {
			!target[key] && (target[key] = [ ]);
			copyProperties(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	});
	return target;
};

/**
 * Same as copyProperties but can handle cyclic structures.
 */
const cloneOnto = exports.cloneOnto = function cloneOnto(target, source) {
	const done = new WeakSet;
	(function doIt(source) {
		if (done.has(source)) { return; }
		done.add(source);
		Object.keys(source).forEach(function(key) {
			if (checkNativeType(source[key], "Object")) {
				!target[key] && (target[key] = { });
				doIt(target[key], source[key]);
			} else if (Array.isArray(source[key])) {
				!target[key] && (target[key] = [ ]);
				doIt(target[key], source[key]);
			} else {
				target[key] = source[key];
			}
		});
	})(source);
	return target;
};

/**
 * Same as copyProperties except that assignments will fail silently, instead of throwing.
 */
const tryCopyProperties = exports.tryCopyProperties = function tryCopyProperties(target, source) {
	Object.keys(source).forEach(function(key) {
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
 * Copies the complete descriptors of the enumerable own properties from one object to an other.
 * @return {object}      The target object.
 */
const assignDescriptors = exports.assignDescriptors = function(to, from) {
	Object.keys(from).forEach(function(key) {
		Object.defineProperty(to, key, Object.getOwnPropertyDescriptor(from, key));
	});
	return to;
};

const Self = new NameSpace;

const ClassPrivate = {

	getSuper(extend) {
		if (!extend) { return; }
		if (typeof extend === 'function') {
			this.extendMode = '__proto__';
			return this.super = extend;
		}
		const _this = this;
		if (![ 'public', 'protected', 'private', ].some(function(mode) {
			_this.extendMode = mode;
			return _this.super = Self(extend[mode]);
		})) {
			this.extendMode = '';
		}
	},

	getNameSpaces() {
		const _super = this.super;
		this.hasPublic = this.getPublic || this.extendMode === 'public' && (_super.hasPublic);
		this.hasProtected = this.getProtected || this.extendMode === 'protected' && (_super.hasPublic || _super.hasProtected);
		this.hasPrivate = this.getPrivate || this.extendMode === 'private' && (_super.hasPublic || _super.hasProtected);
		this.Public = this.hasPublic ?  new NameSpace : idFunction;
		this.Protected = this.hasProtected ?  new NameSpace : idFunction;
		this.Private = this.hasPrivate ?  new NameSpace : idFunction;
	},

	getMethods() {
		this.public = this.getPublic && this.getPublic(this.Private, this.Protected, this.Public) || { };
		this.protected = this.getProtected && this.getProtected(this.Private, this.Protected, this.Public);
		this.private = this.getPrivate && this.getPrivate(this.Private, this.Protected, this.Public);
		switch (this.extendMode) {
			case 'private': {
				this.private = assignDescriptors(this.private, this.super.asProtected);
			} break;
			case 'protected': {
				this.protected = assignDescriptors(this.protected, this.super.asProtected);
			} break;
			case 'public': {
				this.public = copyPublicProperties(Object.create(this.super.public), this.public, this.const);
				this.protected = assignDescriptors(this.protected, this.super.protected);
			} break;
			case '__proto__': {
				this.public = copyPublicProperties(Object.create(this.super.prototype), this.public, this.const);
			} break;
		}
	},

	get asProtected() {
		if (this._asProtected) { return this._asProtected; }
		const patent = this.super ? this.super.asProtected : { };
		return this._asProtected = assignDescriptors(assignDescriptors(parent, this.protected), this.public);
	},

	getConstructorFor(_Protected, _Public) {
		const constructor = this.constructor, _private = this.private || Object.prototype, _protected = this.protected || Object.prototype;
		const Public = this.Public, Protected = this.Protected, Private = this.Private;
		return function() {
			const __private = Object.create(_private);
			const __protected = _Protected ? _Protected(this, Object.create(_protected)) : __private;
			const __public = _Public ? this : __protected;
			Public(__protected, __public); Public(__private, __public);
			Protected(__public, __protected); Protected(__private, __protected);
			Private(__public, __private); Private(__protected, __private);
			return constructor.apply(__public, arguments);
		};
	},

	getConstructor(constructor) {
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
		Constructor.class = this; // TODO: remove

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
	const self = Object.create(ClassPrivate);
	self.const = options.const == null ? true : options.const;
	self.static = options.static;

	self.getPublic = options.public;
	self.getPrivate = options.private;
	self.getProtected = options.protected;

	self.getSuper(options.extends);

	self.getNameSpaces();
	self.getMethods();
	self.getConstructor(options.constructor);

	Self(self.Constructor, self)
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

function idFunction(arg) { return arg; }

const moduleName = 'es6lib/object'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
