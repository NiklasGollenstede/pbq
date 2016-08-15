(function() { 'use strict';

/**
 * A very simple require subset, ment to be loaded in context scripts before loading any modules that use define(name, object|function()) or define(name, dependancies, function(dependancies))
 */

if (typeof window === 'undefined' || typeof window.require !== 'undefined' || typeof window.define !== 'undefined') {
	throw new Error('Can\'t set up define and require');
}

const modules = new Map;
const pending = new Map;
const async   = new Map;

const define = window.define = function define(name, requires, module) {
	if (modules.has(name) || pending.has(name)) { throw new Error('Module "'+ name +'" is already defined'); }
	if (arguments.length > 3) { throw new Error('define() needs 2 or 3 arguments'); }
	if (arguments.length === 2) { module = requires; requires = [ ]; }
	if (typeof module !== 'function') { module = function() { return this; }.bind(module); }
	new Definition(name, requires, module);
};

const require = window.require = function require(name) {
	if (modules.has(name)) { return modules.get(name); }
	throw new Error('Can\'t find module "'+ name +'"');
};
require.async = function requireAsync(name) {
	if (async.has(name)) { return async.get(name); }
	if (modules.has(name)) { return Promise.resolve(modules.get(name)); }
	throw new Error('Can\'t find module "'+ name +'"');
};

function Definition(name, requires, module) {
	this.name = name;
	this.missing = 0;
	this.requires = requires.map(name => modules.has(name) ? modules.get(name) : (++this.missing, name));
	this.module = module;
	async.set(name, new Promise(function(resolve, reject) { this.resolve = resolve; this.reject = reject; }.bind(this)));
	if (this.missing) {
		pending.set(name, this);
	} else {
		this.run();
	}
}
Definition.prototype.check = function(done) {
	if (!this.missing) { return; }
	this.requires.forEach((name, index) => name === done.name && (--this.missing, this.requires[index] = done.exports));
	!this.missing && this.run();
};
Definition.prototype.run = function() {
	pending.delete(this.name);
	try {
		const result = this.module.apply(null, this.requires);
		result && typeof result.then === 'function' ? result.then(this.define.bind(this)).catch(this.failed.bind(this)) : this.define(result);
	} catch (error) { this.failed(error); }
};
Definition.prototype.define = function(exports) {
	this.exports = exports;
	modules.set(this.name, exports);
	this.resolve(exports);
	pending.forEach(function(other) { other.check(this); }.bind(this));
};
Definition.prototype.failed = function(error) {
	console.error('Module definition of "'+ this.name +'" threw:', error);
	this.reject(error);
	throw error;
};

})();
