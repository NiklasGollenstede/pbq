(function() { 'use strict';

/**
 * A very simple require subset, ment to be loaded in context scripts before loading any modules that use define(name, object|function()) or define(name, dependancies, function(dependancies))
 */

if (typeof window === 'undefined' || typeof window.require !== 'undefined' || typeof window.define !== 'undefined') {
	throw new Error('Can\'t set up define and require');
}

const modules = new Map();

const define = window.define = function define(name, requires, module) {
	if (modules.has(name)) { throw new Error('Module "'+ name +'" is already defined'); }
	if (arguments.length >= 3) {
		module = module.apply(null, Array.prototype.map.call(requires, require));
	} else if (typeof requires === 'function') {
		module = requires();
	} else {
		module = requires;
	}
	modules.set(name, module);
};

const require = window.require = function require(name, module) {
	if (!modules.has(name)) { throw new Error('Can\'t find module "'+ name +'"'); }
	return modules.get(name);
};

})();
