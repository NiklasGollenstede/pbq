'use strict';

const deepFreeze = exports.deepFreeze = function deepFreeze(object) { // TODO handle cyclic
	Object.keys.forEach(key => deepFreeze(object[key]));
	return Object.freeze(object);
};

const checkNativeType = exports.checkNativeType = function checkNativeType(object, constructorName) {
	return Object.prototype.toString.call(object).indexOf(constructorName, 8) === 8;
};

const copyProperties = exports.copyProperties = function copyProperties(target, source/*, ...more*/) {
	for (let key in source) {
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
		const args = Array.prototype.slice.call(arguments);
		args.splice(1, 1);
		return copyProperties.apply(null, args);
	}
	return target;
};

const tryCopyProperties = exports.tryCopyProperties = function tryCopyProperties(target, source/*, ...more*/) {
	for (let key in source) {
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
