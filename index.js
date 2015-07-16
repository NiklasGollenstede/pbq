'use strict';
/* global module */

module.exports = {
	get concurrent() {
		return require('./concurrent.js');
	},
	get dom() {
		return require('./dom.js');
	},
	get format() {
		return require('./format.js');
	},
	get functional() {
		return require('./functional.js');
	},
	get namespace() {
		return require('./namespace.js');
	},
	get network() {
		return require('./network.js');
	},
	get object() {
		return require('./object.js');
	},
	get polyfill() {
		return require('./polyfill.js');
	},
	get process() {
		return require('./process.js');
	},
	get fs() {
		return require('./fs.js');
	},
};
