(function(exports) {
'use strict';

const deepFreeze = exports.deepFreeze = function deepFreeze(object) {
	const done = new WeakSet();
	function doIt(object) {
		if (typeof object !== 'object' || object === null || done.has(object)) { return; }
		done.add(object);
		Object.freeze(object);
		Object.keys(object).forEach(key => doIt(object[key]));
	}
	doIt(object);
	return object;
};

const checkNativeType = exports.checkNativeType = function checkNativeType(object, constructorName) {
	return Object.prototype.toString.call(object).indexOf(constructorName, 8) === 8;
};

// TODO: handle circular objects!!
const copyProperties = exports.copyProperties = function copyProperties(target, source/*, ...more*/) {
	for (var key in source) {
		if (checkNativeType(source[key], "Object")) {
			target[key] = target[key] || { };
			copyProperties(target[key], source[key]);
		} else if (Array.isArray(source[key])) {
			target[key] = target[key] || [ ];
			copyProperties(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	if (arguments.length > 2) {
		const args = Array.prototype.slice.call(arguments, 1);
		return copyProperties.apply(null, args);
	}
	return target;
};

const tryCopyProperties = exports.tryCopyProperties = function tryCopyProperties(target, source/*, ...more*/) {
	for (var key in source) {
		if (checkNativeType(source[key], "Object")) {
			try { target[key] = target[key] || { }; } catch (e) { }
			tryCopyProperties(target[key], source[key]);
		} else if (Array.isArray(source[key])) {
			try { target[key] = target[key] || [ ]; } catch (e) { }
			tryCopyProperties(target[key], source[key]);
		} else {
			try { target[key] = source[key]; } catch (e) { }
		}
	}
	if (arguments.length > 2) {
		const args = Array.prototype.slice.call(arguments);
		args.splice(1, 1);
		return tryCopyProperties.apply(null, args);
	}
	return target;
};

const setConst = exports.setConst = function setConst(object, key, value) {
	Object.defineProperty(object, key, { value, enumerable: true, });
	return value;
};

const moduleName = 'es6lib/object'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
