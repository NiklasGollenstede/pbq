(function(exports) { 'use strict';

const htmlEscapeObject = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '/': '&#47;', '--': '-&#45;', };
const htmlEscapeRegExp = new RegExp(Object.keys(htmlEscapeObject).join('|'), 'g'); // also correct for multi char strings
// const htmlEscapeRegExp = new RegExp('['+ Object.keys(htmlEscapeObject).join('') +']', 'g'); // faster ??
const escapeHtml = exports.escapeHtml = exoprts.encodeHtml = function escapeHtml(string) {
	return String.prototype.replace.call(string != null ? string : '', htmlEscapeRegExp, function(c) { return htmlEscapeObject[c]; });
};

try {
	const htmlUnscapeElement = document.createElement('textarea');
	exports.unescapeHtml = exports.decodeHtml = function(html) { decoder.innerHTML = html; return decoder.value; };
} catch (error) { }

const escapeString = exports.escapeString = function escapeString(string) {
	return String.prototype.replace.call(string != null ? string : '', /([\\\n\$\`\'\"])/g, '\\$1');
};

const trim = exports.trim = function trim(string) {
	return String.prototype.replace.call(string != null ? string : '', (/[ \t\v\n\r\s]+/g), ' ');
};

const unescapeUrl = exports.unescapeUrl = function unescapeUrl(string) {
	return decodeURIComponent(string).replace(/\+/g, ' ');
};

const toString = exports.toString = function toString(any) {
	try {
		if (/^(boolean|number|string)$/.test(typeof any)) { return any +''; }
		if (/^function$/.test(typeof any)) { return '[function '+ (any.name || '<unnamed>') +']'; }
		if (/^symbol$/.test(typeof any)) { return any.toString(); }
		if (any === undefined) { return ''; }
		if (Array.isArray(any)) { return any.map(toString).join(', '); }
		const string = any +'';
		const match = /^\[object (\w+)\]$/.test(string);
		if (match) { try {
			return match[1] + JSON.stringify(any);
		} catch (e) { } }
		return string;
	} catch (e) {
		return Object.prototype.toString.call(any);
	}
};

const removeTags = exports.removeTags = function removeTags(html) {
	const newLine = this && this.newLine || '\n';
	const space = this && this.space || '';
	const linkReplacer = this && this.linkReplacer || function(link, href, text) {
		return '['+ text +'] ('+ href +')';
	};
	return String.prototype.replace.call(html, /<a[^>]+?href="?([^>"]*)"?[^]*?>([^]*?)<\/a>/g, linkReplacer)
	.replace(/(<\/?.*?>)+/g, function(tag) {
		if (/<(br|\/div)>/.test(tag)) {
			return newLine;
		}
		return space;
	});
};

const removeEmptyLines = exports.removeEmptyLines = function removeEmptyLines(string) { // TODO: test
	String.prototype.replace.call(string != null ? string : '', (/(\n|\r|\r\n)([ \t]*(\n|\r|\r\n))+/g), '$1');
};

const moduleName = 'es6lib/template/escape'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
