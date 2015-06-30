'use strict';

const toFixedLength = exports.toFixedLength = function toFixedLength(string, length, fill = '0') {
	if (length > (string += '').length) {
		return fill.repeat(length - string.length) + string;
	} else {
		return string.slice(string.length - length);
	}
};

const secondsToHhMmSs = exports.secondsToHhMmSs = function secondsToHhMmSs(time) {
	time = +time;
	let hours = Math.floor(time / 3600); time = time % 3600;
	let ret = Math.floor(time / 60) +":"+ (time % 60 < 10 ? ("0" + time % 60) : (time % 60));
	if (hours) { ret = hours + (ret.length > 4 ? ':' : ':0') +ret; }
	return ret;
};

const hhMmSsToSeconds = exports.hhMmSsToSeconds = function hhMmSsToSeconds(time) {
	time = time.split(":").map(parseFloat);
	while(time.length > 1) {
		time[0] = time[1] + 60 * time.shift();
	}
	return time[0];
};

const timeToRoundString = exports.timeToRoundString = function timeToRoundString(time, tolerance) {
	time = +time; tolerance = tolerance || 1;
	let names = [ "ms", "seconds", "minutes", "hours", "days", "month", "years" ];
	let sizes = [ 1000, 60, 60, 24, 30.4375, 12, Number.MAX_VALUE];
	if (!time) { return "0"+ names[0]; }
	let sign = "";
	if (time < 0) { time *= -1; sign = "-"; }
	let i = 0;
	while (time > sizes[i] * tolerance) {
		time = Math.floor(time / sizes[i]);
		i++;
	}
	return sign + time +" "+ names[i];
};

const exponentAliases = { "-9": "p", "-6": "µ", "-3": "m", 0: "", 3: "k", 6: "M", 9: "G", 12: "T", };
const numberToRoundString = exports.numberToRoundString = function numberToRoundString(number, digits) {
	digits = (digits >= 0) ? digits : 3;
	let exponent = +number.toExponential(0).match(/e([+-]?\d+)/)[1];
	exponent = Math.trunc((exponent > 0 ? exponent : exponent - 2) / 3) * 3;
	number /= Math.pow(10, exponent);
	digits -= number.toFixed(0).length;
	return number.toFixed(digits) + (exponentAliases[exponent] != null ? exponentAliases[exponent] : "e"+ exponent);
};

const QueryObject = exports.QueryObject = function QueryObject(query, key, value = '=') {
	if (!(this instanceof QueryObject)) { return new QueryObject(query, key, value); }
	query.split(key || /[&#?]+/).map(s => s.split(value)).forEach(p => (p[0] && (this[p[0]] = p[1])));
	// Self.set(this, copyProperties({ }, this));
};
/*QueryObject.prototype.hasChanged = function() {
	let length = 0;
	let self = Self.get(this);
	for (let key in this) {
		if (this[key] != self[key]) { return true; }
		++length;
	}
	return Object.keys(self).length !== length;
};*/
QueryObject.prototype.toString = function() {
	let ret = "";
	for (let key in this) { if (this.hasOwnProperty(key)) {
			ret += "&"+ key + ((this[key] != null) ? ("="+ this[key]) : "");
	} }
	return ret.substring(1);
};
