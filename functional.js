(function(global) { 'use strict'; const factory = function es6lib_functional(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
/* global performance */

/**
 * Object/Function that returns itself when called and on every property access.
 * Turns into the empty string or NaN when casted to a primitive,
 * simulates a .__proto__ of null and ignores any property assignments or definitions.
 * But it throws when preventExtensions is called on it.
 */
const noop = exports.noop = (typeof Proxy !== 'undefined') && (function(noop) {
	const keys = [ ];
	const target = function() { return noop; }.bind();
	delete target.name; delete target.length;

	return (noop = new Proxy(target, {
		setPrototypeOf     () { return true; },
		getPrototypeOf     () { return null; },
		preventExtensions  () { throw new TypeError(`noop needs to be extensible`); }, // need to freeze the target or throw
		defineProperty     () { return true; },
		set                () { return true; },
		has                () { return false; },
		get                (_, key) { switch (key) {
			case Symbol.toPrimitive: return function(type) { return type === 'number' ? NaN : ''; };
			case Symbol.toStringTag: return 'no-op';
			case '__proto__': return null;
			default: return noop;
		} },
	}));
})();

/**
 * Function.prototype.apply optimised for the common case (no this and/or few arguments).
 * @param  {Function}   callback The function to call
 * @param  {any}        self     Optional this for callback
 * @param  {Arguments}  args     Optional argument (array-like) for callback
 * @param  {any}        arg      Additional argument to push on top of args
 * @return {any}                 Callbacks return value
 */
const apply = exports.apply = function apply(callback, self, args, arg) {
	const haveArg = arguments.length > 3;
	switch (((args && args.length) + haveArg) || 0) {
		case 0: {
			return self ? callback.call(self) : callback();
		} break;
		case 1: {
			return callback.call(self, haveArg ? arg : args[0]);
		} break;
		case 2: {
			return callback.call(self, args[0], haveArg ? arg : args[1]);
		} break;
		case 3: {
			return callback.call(self, args[0], args[1], haveArg ? arg : args[2]);
		} break;
		default: {
			if (haveArg) {
				args = Array.prototype.slice.call(args);
				args.push(arg);
			}
			return callback.apply(self, args);
		}
	}
};

/**
 * Tests whether a function can be used as a constructor, without attempting to call that function.
 * @param  {function}  func  Function object to test.
 * @return {Boolean}         True iff func has a [[Construct]] internal method.
 *                           That is, if it returns false, then func is not a function or constructing it with new would throw 'TypeError: <local id> is not a constructor'.
 *                           If it returns true, it may still throw 'TypeError: Illegal constructor.', but is is a constructor.
 */
const isConstructable = exports.isConstructable = function isConstructable(func) {
	try {
		construct(Ctor, [ ], func);
		return true;
	} catch (_) {
		return false;
	}
};
class Ctor { }
const { construct, } = Reflect;

/**
 * console.log's it's arguments
 * @return {any} the last argument
 */
const log = exports.log = exports.debugLog = function log() {
	console.log.apply(console, arguments);
	return arguments[arguments.length - 1];
};

/**
 * Returns a function that executes a callback after it has not been called for a certain time.
 * The arguments and this reference passed to the callback will be those of the last call to the returned function.
 * @param  {function}  callback  The function to call.
 * @param  {natural}   time      The cool down duration in ms.
 * @return {function}            Asynchronous, debounced version of callback.
 */
const debounce = exports.debounce = function debounce(callback, time) {
	var timer = null;
	return function() {
		clearTimeout(timer);
		const args = arguments, self = this;
		timer = setTimeout(function() {
			apply(callback, self, args);
		}, time);
	};
};

/**
 * Wraps a (void to void) function such that it is called asynchronously and at most once every 'time' ms.
 * The callback gets called exactly once asap after any number of calls, but is never called more than once every 'time' ms
 * @param  {function}  callback  The function to wrap.
 * @param  {[type]}    time      The minimum time between two calls in milliseconds.
 * @return {[type]}              The throttled function.
 */
const throttle = exports.throttle = function throttle(callback, time) {
	var pending = false, last = 0;
	return function() {
		if (pending) { return; }
		const wait = last + time - Date.now();
		pending = true;
		setTimeout(function() {
			last = Date.now();
			pending = false;
			callback();
		}, wait > 0 ? wait : 0); // mustn't be << 0 in chrome 53+
	};
};

/**
 * Systems non-absolute but continuous high resolution time
 * @return {uint}   hrtime in ms, accuracy ~µs
 */
const hrtime = exports.hrtime = (function() {
	if (typeof performance !== 'undefined') {
		return performance.now.bind(performance); // browser
	} else if (typeof process !== 'undefined' && typeof process.hrtime === 'function') {
		return function () { const pair = process.hrtime(); return pair[0] * 1e3 + pair[1] / 1e6; }; // node
	} else {
		return require("chr" + "ome").Cu.now; // firefox
	}
})();

/**
 * Timer that saves a high resolution time upon creation
 * @param    {uint}     start  start time can (but shouldn't) be passed to overwrite the start time
 * @return   {function}        function that returns the time difference between Timer creation an it's call
 * @example  timer = new Timer; doStuff(); diff1 = timer(); doMore(); diff2 = timer();
 */
const Timer = exports.Timer = function Timer() {
	const start = hrtime();
	return function() { return hrtime() - start; };
};

/**
 * Counter
 * @param  {Number}   start initial counter value
 * @return {function}       a function that increments start by one at each call and returns the implemented value
 * @method {Number}   get   returns the current value (without incrementing it)
 */
const Counter = exports.Counter = function Counter(start) {
	start = +start || 0;
	return Object.assign(function() { return ++start; }, { get: function() { return start; }, });
};

/**
 * Logger
 * @param {...[type]} outer first args
 */
// (...outer) => (...inner) => log(...outer, ...inner);
const Logger = exports.Logger = function Logger() {
	const outer = arguments;
	return function() {
		const args = [];
		args.push.apply(args, outer);
		args.push.apply(args, arguments);
		return log.apply(null, args);
	};
};

/**
 * callback that blocks an events propagation and default action
 */
const blockEvent = exports.blockEvent = function blockEvent(event) {
	event.preventDefault();
	event.stopPropagation && event.stopPropagation();
};

/**
 * string similarity norm, inspired by http://www.catalysoft.com/articles/StrikeAMatch.html
 * @param  {[type]} s1 input, commutative
 * @param  {[type]} s2 input, commutative
 * @param  {[type]} n  length of sequences to match
 * @return {float}     similarity of s1 and s1. Between 1 for two equal strings and 0 if there is no substeing s of s1 and length n that is also substring of s2
 */
const fuzzyMatch = exports.fuzzyMatch = function fuzzyMatch(s1, s2, n) {
	n = n > 2 && Number.parseInt(n) || 2;
	const l1 = s1.length - n + 1;
	const l2 = s2.length - n + 1;
	const used = new Array(l2);
	var total = 0;
	for (var i = 0; i < l1; ++i) {
		var j = -1;
		while ( // find s1.substr in s2 that wasn't used yet
			((j = s2.indexOf(s1.substring(i, i + n), j + 1)) !== -1)
			&& used[j]
		) { }
		if (j !== -1) {
			total++;
			used[j] = true;
		}
	}
	return (l1 + l2) ? 2 * total / (l1 + l2) : 0;
};

/**
 * Wraps a function in a simple Map based cache. The cache key is the first argument passed to the resulting function.
 * @param  {function}  func   The function whose results are to be cached.
 * @param  {Map}       cache  Optional object with .get() and .set() functions (e.g. a WeakMap or Map). Defaults to a new Map().
 * @return {function}         The func parameter wrapped such that its return values will be cached with the first argument as the key. All arguments are forwarded to func.
 */
const cached = exports.cached = function cached(func, cache) {
	cache = cache || new Map;
	const ret = function(arg) {
		if (cache.has(arg)) { return cache.get(arg); }
		const result = func.apply(this, arguments);
		cache.set(arg, result);
		return result;
	};
	return ret;
};

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { global[factory.name] = result; } } })(this);
