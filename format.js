(function(exports) { 'use strict';

/**
 * Turns a template string containing an extended RegExp, which may contain uninterpreted whitespaces
 * and # comments, into a regular RegExp object.
 * Must be called as a template string tagging function.
 * Since it uses the template strings '.raw' property, no additional escaping compared to regular RegExp,
 * expressions is required, except that whitespaces and '#' characters that are not to be removed need to be escaped.
 * Note: The sequence '${' needs to be escaped to '\${' and will then appear as '\${' in the resulting RegExp.
 * The usual flags 'gim' may follow the RegExp itself after a closing '/'.
 * Example:
 *     RegExpX`a` <= same as => /a/
 *     RegExpX`a/i` <= same as => /a/i
 *     RegExpX`[\n\ ] # newline or space
 *             \/ # an escaped slash
 *             \# not a comment
 *             /g` <= same as => /[\n ]\/#notacomment/g
 *     RegExpX`^ . * ? x / g i m` <= smae as => /^.*?x/gim
 * As a plus, you can also use variables in your RegExp's, e.g.:
 *     var newLine = '[\\n\\r]'; // string
 *     var sentence = /[\w\.\ 0-9]/; // RegExp (modifiers ignored)
 *     RegExpX`(${sentence}(<br><\/br>)+${newLine})+` <= same as => /([\w\. 0-9](<br><\/br>)+[\n\r])+/
 */
function RegExpX() {
	// use '.source' property if variable is a RegExp
	for (let i = 1, l = arguments.length; i < l; ++i) {
		arguments[i] && arguments[i].source && (arguments[i] = arguments[i].source);
	}
	// get the string exactly as typed ==> no further escaping necessary
	const raw = String.raw.apply(String, arguments)
	// remove all '#'+string which are not escaped, i.e. preceded my an odd number of '\'
	.replace(/(\\*)#.*/g, unescapeOrRemove)
	// do the same for all whitespaces afterwards, so that sections behind escaped '#' are processed
	.replace(/(\\*)\s/g, unescapeOrRemove);
	function unescapeOrRemove(m, bs) { return bs.length % 2 ? m.slice(1) : bs; }

	// flags may optionally be appended after a (not escaped) closing '/'. (The opening '/' is implicit)
	const end = /(\\*)\/(.*)/g;
	let mods; do {
		mods = end.exec(raw); // find slash
	} while (mods && mods[1].length % 2 !== 0 && (end.lastIndex -= mods[2].length)); // repeat if slash was escaped

	return mods ? new RegExp(raw.slice(0, -(mods[2].length + 1)), mods[2]) : new RegExp(raw);
}

/**
 * Fills or truncates a string so that 'string'.length === 'length'
 * @param  {string} string input, will be casted to string
 * @param  {uint}   length length the output will have, defaults to string.length
 * @param  {char}   fill   char used to add padding, defaults to '0'
 * @return {string}        string of .length length
 */
const toFixedLength = exports.toFixedLength = function toFixedLength(string, length, fill) {
	fill = fill ? (fill+'')[0] : '0';
	if (length > (string += '').length) {
		return fill.repeat(length - string.length) + string;
	} else {
		return string.slice(string.length - length);
	}
};

/**
 * uses Math.random() to generste a random hex string
 * @param {uint}  lenth  the length of the string to generate, max precision 13
 */
const randomHex = exports.randomHex = function randomHex(length) {
	return toFixedLength(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16), length);
};

/**
 * generste a GUID, e.g.: 6f2e78a1-c4f3-4895-858b-347f92fb2d14
 */
const Guid = exports.Guid = function Guid() {
	return [ randomHex(8), randomHex(4), '4'+ randomHex(3), '8'+ randomHex(3), randomHex(8) + randomHex(8), ].join('-');
};

/**
 * @param  {uint}   time input time in seconds
 * @return {string}      the time part of new Date(time * 1000).toUTCString(), hurs only if !== 0
 */
const secondsToHhMmSs = exports.secondsToHhMmSs = function secondsToHhMmSs(time) {
	time = +time;
	let hours = Math.floor(time / 3600); time = time % 3600;
	let ret = Math.floor(time / 60) +":"+ (time % 60 < 10 ? ("0" + time % 60) : (time % 60));
	if (hours) { return hours + (ret.length > 4 ? ':' : ':0') +ret; }
	return ret;
};

/**
 * @param  {string} time hh:mm:SS.ss
 * @return {uint}        time in seconds
 */
const hhMmSsToSeconds = exports.hhMmSsToSeconds = function hhMmSsToSeconds(time) {
	time = time.split(":").map(parseFloat);
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
	let many = [ "ms", "seconds", "minutes", "hours", "days", "months", "years" ];
	let one = [ "ms", "second", "minute", "hour", "day", "month", "year" ];
	let sizes = [ 1000, 60, 60, 24, 30.4375, 12, Number.MAX_VALUE];
	if (!time) { return "0"+ many[0]; }
	let sign = "";
	if (time < 0) { time *= -1; sign = "-"; }
	let i = 0;
	while (time > sizes[i] * tolerance) {
		time = Math.floor(time / sizes[i]);
		i++;
	}
	return sign + time +" "+ (time == 1 ? one[i] : many[i]);
};

/**
 * outputs a number as a human readable string like '12.3 µ', '42', '1.05 T'
 * @param  {number} number  input
 * @param  {uint}   digits  significant digits in the output
 * @return {string}         s.o.
 */
const exponentAliases = { "-9": "p", "-6": "µ", "-3": "m", 0: "", 3: "k", 6: "M", 9: "G", 12: "T", };
const numberToRoundString = exports.numberToRoundString = function numberToRoundString(number, digits) {
	digits = (+digits > 0) ? Number.parseInt(digits) : 3;
	let exponent = +number.toExponential(0).match(/e([+-]?\d+)/)[1];
	exponent = Math.trunc((exponent > 0 ? exponent : exponent - 2) / 3) * 3;
	number /= Math.pow(10, exponent);
	digits -= number.toFixed(0).length;
	return number.toFixed(digits) + (exponentAliases[exponent] != null ? exponentAliases[exponent] : "e"+ exponent);
};

/**
 * turns a (url) query string into an object and back
 * @param {string}           query the query string
 * @param {string || RegExp} key   sequence used to seperate key/value-pairs, defaults to anyPositiveNumberOf('&', '#', '?')
 * @param {string || RegExp} value sequence used to seperate keys from values, defaults to '=', value may be optional (in the query)
 * @param {QueryObject}      instance of QueryObject that has properties as read from the query
 */
const QueryObject = exports.QueryObject = function QueryObject(query, key, value) {
	value = value || '=';
	const self = (this instanceof QueryObject) ? this : Object.create(QueryObject.prototype);
	query.split(key || /[&#?]+/)
	.map(function(string) { return string.split(value); })
	.forEach(function(pair) { pair[0] && (self[pair[0]] = pair[1]); });
};
/**
 * turns the QueryObject back into a query string
 * @param  {string} keySep   seperator between key/value-pairs, defaults to '&'
 * @param  {string} valueSep seperator between key and value, defaults to '='
 * @return {string}          the query string representation of this
 */
QueryObject.prototype.toString = function(keySep, valueSep) {
	keySep = keySep || '&'; valueSep = valueSep || '=';
	return Object.keys(this).reduce(function(ret, key) {
		return ret + keySep + key + ((this[key] !== null) ? (valueSep + this[key]) : '');
	}.bind(this), '').substring(1);
};

const moduleName = 'es6lib/format'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
