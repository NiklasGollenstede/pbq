define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	exports,
}) {

/**
 * Turns a template string containing an extended RegExp, which may contain uninterpreted whitespaces
 * and # comments, into a regular RegExp object.
 * Must be called as a template string tagging function.
 * Since it uses the template strings '.raw' property, no additional escaping compared to regular RegExp
 * literal is required, except that whitespaces and '#' characters that are not to be removed need to be escaped.
 * Note: The sequence '${' needs to be escaped to '\${' or '$\{' and will then appear as '\${' or '$\{' in the resulting RegExp.
 * The usual flags 'gim(uy)' may follow the RegExp itself after a closing '/'.
 * Example:
 *     RegExpX`a` <= same as => /a/
 *     RegExpX`a/i` <= same as => /a/i
 *     RegExpX`[\n\ ] # newline or space
 *             \/ # an escaped slash
 *             \# not a comment
 *             /g` <= same as => /[\n ]\/#notacomment/g
 *     RegExpX`^ . * ? x / g i m` <= smae as => /^.*?x/gim
 * As a plus, you can also use variables in your RegExp's, e.g.:
 *     var newLine = '[\\r\\n]'; // string
 *     var sentence = /([\w\.\ 0-9]*)/; // RegExp (modifiers ignored)
 *     RegExpX`(${ sentence } (<br><\/br>)+ ${ newLine })+` <= same as => /(([\w\. 0-9]*)(<br><\/br>)+[\r\n])+/
 */
const RegExpX = exports.RegExpX = function RegExpX() {
	// use '.source' property if variable is a RegExp
	for (var i = 1, l = arguments.length; i < l; ++i) {
		arguments[i] && arguments[i].source && (arguments[i] = arguments[i].source);
	}

	var flags = '';

	// get the string exactly as typed ==> no further escaping necessary
	const source = String.raw.apply(String, arguments)

	// remove all '#'+comments which are not escaped, i.e. they are preceded my an even number of '\'
	.replace(/(^|[^\\])((\\\\)*)#.*/g, '$1$2')
	// remove '\' used to escape an '#'
	.replace(/\\((\\\\)*)#/g, '$1#')

	// remove all whitespace characters which are not escaped or remove an escaping slash for each escaped whitespace
	.replace(/(\\*)\s/g, function(match, slashes) { return slashes.length % 2 ? match.slice(1) : slashes; })

	// if a not escaped '/' is present, it separates the flags from the source
	.replace(/(^|[^\\])((?:\\\\)*)\/([^]*)$/, function(match, char, slashes, _flags) { flags = _flags; return char + slashes; });

	return new RegExp(source, flags);
};

/**
 * Fills or truncates a string at its start so that string.length === length
 * @param  {string}   string  Input, will be casted to string
 * @param  {natural}  length  Length the output will have, defaults to string.length
 * @param  {char}     fill    Character used to add padding, defaults to '0'
 * @return {string}           string of .length length
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
 * turns a (url) query string into an object and back
 * @param  {string}            query     the query string
 * @param  {string || RegExp}  key       sequence used to separate key/value-pairs, defaults to anyPositiveNumberOf('&', '#', '?')
 * @param  {string || RegExp}  value     sequence used to separate keys from values, defaults to '=', value may be optional (in the query)
 * @param  {function}          decoder   Optional function sued to decode value segments.
 * @return {QueryObject}       QueryObject instance that has properties as read from the query
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
 * turns the QueryObject back into a query string
 * @param  {string}    keySep    Separator between key/value-pairs, defaults to '&'
 * @param  {string}    valueSep  Separator between key and value, defaults to '='
 * @param  {function}  encoder   Optional function sued to encode value segments.
 * @return {string}              the query string representation of this
 */
QueryObject.prototype.toString = function(keySep, valueSep, encoder) {
	const self = this;
	valueSep = valueSep || '='; encoder = encoder || function(id) { return id; };
	return Object.keys(self).map(function(key) {
		return key + valueSep + (self[key] !== null ? encoder(self[key]) : '');
	}).join(keySep || '&');
};

});
