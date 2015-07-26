(function(exports) {
'use strict';
/* global module */

exports = {
	get concurrent() {
		return require('es6lib/concurrent');
	},
	get dom() {
		return require('es6lib/dom');
	},
	get firefox() {
		return require('es6lib/firefox');
	},
	get format() {
		return require('es6lib/format');
	},
	get functional() {
		return require('es6lib/functional');
	},
	get fs() {
		return require('es6lib/fs');
	},
	get graph() {
		return require('es6lib/graph');
	},
	get namespace() {
		return require('es6lib/namespace');
	},
	get network() {
		return require('es6lib/network');
	},
	get object() {
		return require('es6lib/object');
	},
	get polyfill() {
		return require('es6lib/polyfill');
	},
	get process() {
		return require('es6lib/process');
	},
	get template() {
		return require('es6lib/template');
	},
};

const moduleName = 'es6lib'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
