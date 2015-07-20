console.log('1');
(function(exports) {
'use strict';
/* global module */
console.log('2');
const transform = typeof module === 'undefined'
? function(name) { return 'es6lib/'+ name; }
: function(name) { return './'+ name +'.js'; };

exports = {
	get concurrent() {
		return require(transform('concurrent'));
	},
	get dom() {
		return require(transform('dom'));
	},
	get firefox() {
		return require(transform('firefox'));
	},
	get format() {
		return require(transform('format'));
	},
	get functional() {
		return require(transform('functional'));
	},
	get graph() {
		return require(transform('graph'));
	},
	get namespace() {
		return require(transform('namespace'));
	},
	get network() {
		return require(transform('network'));
	},
	get object() {
		return require(transform('object'));
	},
	get polyfill() {
		return require(transform('polyfill'));
	},
	get process() {
		return require(transform('process'));
	},
	get fs() {
		return require(transform('fs'));
	},
};

const moduleName = 'es6lib'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
