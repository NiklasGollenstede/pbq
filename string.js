(() => { 'use strict'; const factory = function es6lib_string(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

/// RegExpX has been removed
Object.defineProperty(exports, 'RegExpX', { get() { throw new Error(`'RegExpX' has been removed from this file, use the 'regexpx' module instead`); }, });

/**
 * Pads or truncates a string on its left/start so that string.length === length.
 * @param  {string}   string  Input, will be casted to string.
 * @param  {natural}  length  Length the output will have, defaults to string.length
 * @param  {char}     fill    String whose first character is used to add padding if needed, defaults to '0'
 * @return {string}           string of .length length
 */
const toFixedLength = exports.toFixedLength = function toFixedLength(string, length, fill) {
	if (length > (string += '').length) {
		fill = fill ? (fill+'')[0] : '0';
		return fill.repeat(length - string.length) + string;
	} else {
		return string.slice(string.length - length);
	}
};

/**
 * Generates a fixed-length string of random characters to a base.
 * @param {number}  chars  The numbers of chars to return, i.e. the returned string's .length.
 * @param {number}  base   Optional. The numerical base of the random characters, encoded as [1-9a-z], must be <= 36. Default: 16.
 */
const randomHex = exports.randomHex = (function() { try {
	if (typeof window !== 'undefined' && window.crypto) {
		const rand = window.crypto.getRandomValues.bind(window.crypto);
		const Uint32Array = window.Uint32Array;
		return function randomHex(chars, base) {
			base = +base || 16;
			const data = rand(new Uint32Array(Math.ceil(chars * Math.log2(base) / 28)));
			return toFixedLength(Array.prototype.map.call(data, _=>_.toString(base)).join(''), chars);
		};
	} else {
		const rand = require('crypto').randomBytes;
		return function randomHex(chars, base) {
			base = +base || 16;
			const data = rand(Math.ceil(chars * Math.log2(base) / 7));
			return toFixedLength(Array.prototype.map.call(data, _=>_.toString(base)).join(''), chars);
		};
	}
} catch (_) { } })();

/**
 * Generates a cryptographically random GUID, e.g.: 6f2e78a1-c4f3-4895-858b-347f92fb2d14
 */
const Guid = exports.Guid = function Guid() {
	var data = randomHex(34);
	return [ data.slice(0, 8), data.slice(8, 12), '4'+ data.slice(12, 15), '8'+ data.slice(15, 18), data.slice(18), ].join('-');
};

/**
 * @param  {uint}   time input time in seconds
 * @return {string}      the time part of new Date(time * 1000).toUTCString(), hurs only if !== 0
 */
const secondsToHhMmSs = exports.secondsToHhMmSs = function secondsToHhMmSs(time) {
	time = +time;
	const hours = Math.floor(time / 3600); time = time % 3600;
	const ret = Math.floor(time / 60) +':'+ (time % 60 < 10 ? ('0' + time % 60) : (time % 60));
	if (hours) { return hours + (ret.length > 4 ? ':' : ':0') +ret; }
	return ret;
};

/**
 * @param  {string} time hh:mm:SS.ss
 * @return {uint}        time in seconds
 */
const hhMmSsToSeconds = exports.hhMmSsToSeconds = function hhMmSsToSeconds(time) {
	time = time.split(':').map(parseFloat);
	while(time.length > 1) {
		time[0] = time[1] + 60 * time.shift();
	}
	return time[0];
};

/**
 * outputs a time/duration as a human readable string like '12 ms', '3 months'
 * @param  {uint}   time
 * @param  {float}  tolerance tolerance to use smaler unit than possible, e.g. '45 days' instead of '1 month' with tolerance = 1.5
 * @return {string}           s.o.
 */
const timeToRoundString = exports.timeToRoundString = function timeToRoundString(time, tolerance) {
	time = +time; tolerance = +tolerance || 1;
	const many = [ "ms", "seconds", "minutes", "hours", "days", "months", "years" ];
	const one = [ "ms", "second", "minute", "hour", "day", "month", "year" ];
	const sizes = [ 1000, 60, 60, 24, 30.4375, 12, Number.MAX_VALUE];
	if (!time) { return "0"+ many[0]; }
	var sign = "";
	if (time < 0) { time *= -1; sign = "-"; }
	var i = 0;
	while (time > sizes[i] * tolerance) {
		time = Math.floor(time / sizes[i]);
		i++;
	}
	return sign + time +" "+ (time == 1 ? one[i] : many[i]);
};

/**
 * outputs a number as a human readable string like '12.3µ', '42', '1.05T'
 * @param  {number} number  input
 * @param  {uint}   digits  significant digits in the output
 * @return {string}         s.o.
 */
const exponentAliases = { "-9": "p", "-6": "µ", "-3": "m", 0: "", 3: "k", 6: "M", 9: "G", 12: "T", };
const numberToRoundString = exports.numberToRoundString = function numberToRoundString(number, digits) {
	if (typeof number !== 'number') { return '0'; }
	digits = (+digits > 3) ? +digits : 3;
	const match = number.toExponential(digits + 2).match(/(-?)(.*)e(.*)/);
	const exponent = +match[3];
	const unit = Math.floor(exponent / 3) * 3;
	const shift = exponent - unit;
	const mantissa = shift ? match[2].replace(/(\d)\.(\d)(\d)(\d*)/, (x, _1, _2, _3, _R) =>
		shift === 1
		? (_1 + _2 +'.'+ _3 + _R.slice(0, digits - 3))
		: (_1 + _2 + _3 + (digits <= 3 ? '' : +'.'+ _R.slice(0, digits - 3)))
	) : match[2].slice(0, digits + 1);
	return match[1] + mantissa + (exponentAliases[unit] != null ? exponentAliases[unit] : "e"+ unit);
};

/**
 * Turns a (url) query string into an object (similar to URLSearchParams).
 * @param  {string}            query     The query string.
 * @param  {string || RegExp}  key       Sequence used to separate key/value-pairs, defaults to anyPositiveNumberOf('&', '#', '?').
 * @param  {string || RegExp}  value     Sequence used to separate keys from values, defaults to '=', value may be optional (in the query).
 * @param  {function}          decoder   Optional. Function used to decode value segments. Defaults to id function.
 * @return {QueryObject}                 QueryObject instance that has properties as read from the query.
 */
const QueryObject = exports.QueryObject = function QueryObject(query, key, value, decoder) {
	value = value || '='; decoder = decoder || function(id) { return id; };
	const self = (this instanceof QueryObject) ? this : Object.create(QueryObject.prototype);
	String.prototype.split.call(query, key || (/[&#?]+/))
	.map(function(string) { return string.split(value); })
	.forEach(function(pair) { pair[0] && (self[pair[0]] = decoder(pair[1])); });
	return self;
};
/**
 * Turns the QueryObject back into a query string.
 * @param  {string}    keySep    Separator between key/value-pairs, defaults to '&'.
 * @param  {string}    valueSep  Separator between key and value, defaults to '='.
 * @param  {function}  encoder   Optional function used to encode value segments.
 * @return {string}              the query string representation of this
 */
QueryObject.prototype.toString = function(keySep, valueSep, encoder) {
	const self = this;
	valueSep = valueSep || '='; encoder = encoder || function(id) { return id; };
	return Object.keys(self).map(function(key) {
		return key + valueSep + (self[key] !== null ? encoder(self[key]) : '');
	}).join(keySep || '&');
};

/**
 * Replaces HTML control characters in a string with their escape entities.
 * @param  {string}  html  A string possibly containing control characters.
 * @return {string}        A string without any control characters, whose unescapeHtml() is the input.
 */
const escapeHtml = exports.escapeHtml = exports.encodeHtml = function escapeHtml(html) {
	return html.replace(htmlEscapeRegExp, function(c) { return htmlEscapeObject[c]; });
};
const htmlEscapeObject = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '/': '&#47;', '--': '-&#45;', };
const htmlEscapeRegExp = new RegExp(Object.keys(htmlEscapeObject).join('|'), 'g'); // also correct for multi char strings
// const htmlEscapeRegExp = new RegExp('['+ Object.keys(htmlEscapeObject).join('') +']', 'g'); // faster ??

/**
 * Decodes any HTML entities in a string with their utf8 representation.
 * Note: this function will only be present in a browser environment.
 * @param  {string}  html  The markup whose entities should be decoded.
 * @return {string}        The same markup without any HTML entities.
 */
try {
	const htmlUnscapeElement = document.createElement('textarea');
	exports.unescapeHtml = exports.decodeHtml = function(html) { htmlUnscapeElement.innerHTML = html; return htmlUnscapeElement.value; };
} catch (error) { }

/**
 * Escapes a string so that it can be placed within another string when generating JavaScript code.
 * @param  {string}  string  String that should be placed within another string.
 * @return {string}          Escaped string that, when pared, gives the same sequence of characters as the input string.
 */
const escapeString = exports.escapeString = function escapeString(string) {
	return String.prototype.replace.call(string != null ? string : '', /([\\\n\$\`\'\"])/g, '\\$1');
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

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exports = { }, result = factory(exports) || exports; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { window[factory.name] = result; } } })();
