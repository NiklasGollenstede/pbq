(function() { 'use strict';

/**
 * A very simple require subset, ment to be loaded in context scripts before loading any modules that use define(name, object)
 */

if (typeof window === 'undefined' || typeof window.require !== 'undefined' || typeof window.define !== 'undefined') {
	throw new Error('Can\'t set up define and require');
}

const modules = new Map();

window.define = function define(name, module) {
	if (modules.has(name)) {
		throw new Error(`Module "${ name }" is already defined`);
	}
	modules.set(name, module);
	console.log('defined module', name/*, module*/);
	return module;
};

window.require = function require(name, module) {
	if (!modules.has(name)) {
		throw new Error(`Can't find module "${ name }"`);
	}
	return modules.get(name);
};

})();
