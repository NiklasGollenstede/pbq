define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	exports,
}) {

const htmlEscapeObject = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '/': '&#47;', '--': '-&#45;', };
const htmlEscapeRegExp = new RegExp(Object.keys(htmlEscapeObject).join('|'), 'g'); // also correct for multi char strings
// const htmlEscapeRegExp = new RegExp('['+ Object.keys(htmlEscapeObject).join('') +']', 'g'); // faster ??
const escapeHtml = exports.escapeHtml = exports.encodeHtml = function escapeHtml(string) {
	return String.prototype.replace.call(string != null ? string : '', htmlEscapeRegExp, function(c) { return htmlEscapeObject[c]; });
};

try {
	const htmlUnscapeElement = document.createElement('textarea');
	exports.unescapeHtml = exports.decodeHtml = function(html) { htmlUnscapeElement.innerHTML = html; return htmlUnscapeElement.value; };
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

});
