(function(exports) {
'use strict';
/* global performance */

/**
 * Object/Function that returns itself on execution and every property access. Stateless
 */
const noop = exports.noop = ((self = new Proxy(() => self, { get: () => self, set() { }, })) => self)();

/**
 * console.log's it's arguments
 * @return {any} the last argument
 */
const log = exports.log = exports.debugLog = function log() {
	console.log.apply(console, arguments);
	return arguments[arguments.length - 1];
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
		return require("chrome").Cu.now; // firefox
	}
})();

/**
 * Timer that saves a high resolution time upon creation
 * @param    {uint}     start  start time can (but shouldn't) be passed to overwrite the start time
 * @return   {function}        function that returns the time difference between Timer creation an it's call
 * @example  timer = new Timer; doStuff(); diff1 = timer(); doMore(); diff2 = timer();
 */
const Timer = exports.Timer = function Timer(start = hrtime()) {
	return (end = hrtime()) => (end - start);
};

/**
 * Counter
 * @param  {Number}   start initial counter value
 * @return {function}       a function that increments start by one at each call and returns the implemented value
 * @method {Number}   get   returns the current value (without incrementing it)
 */
const Counter = exports.Counter = function Counter(start = 0) {
	return Object.assign(() => ++start, { get: () => start, });
};

/**
 * Logger
 * @param {...[type]} outer first args
 */
const Logger = exports.Logger = function Logger(...outer) {
	return (...inner) => console.log(...outer, ...inner);
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
	var l1 = s1.length - n + 1;
	var l2 = s2.length - n + 1;
	var used = new Array(l2);
	var total = 0;
	for (var i = 0; i < l1; ++i) {
		var j = -1;
		while ( // find s1.substr in s2 that wasn't used yet
			((j = s2.indexOf(s1.substring(i, i+n), j+1)) !== -1)
			&& used[j]
		) { }
		if (j != -1) {
			total++;
			used[j] = true;
		}
	}
	return (l1 + l2) ? 2 * total / (l1 + l2) : 0;
};


// untested
const Cache = exports.Cache = function Cache(compute, options) {
	if (typeof compute !== 'function') {
		options = compute;
		compute = options.compute;
	}
	// const { strategy, } = options || { };

	const levelOne = {
		objects: new WeakMap(),
		primitives: new Map(),
		// value: null,
	};

	const findLevel = args => args.reduce((level, arg, index) => {
		console.log('looking for', arg, 'in', level, index);
		if (arg !== null && typeof arg === 'object') {
			if (!level.objects) {
				level.objects = new WeakMap();
				const next = { };
				level.objects.set(arg, next);
				return next;
			}
			if (level.objects.has(arg)) {
				return level.objects.get(arg);
			} else {
				const next = { };
				level.objects.set(arg, next);
				return next;
			}
		} else {
			if (!level.primitives) {
				level.primitives = new Map();
				const next = { };
				level.primitives.set(arg, next);
				return next;
			}
			if (level.primitives.has(arg)) {
				return level.primitives.get(arg);
			} else {
				const next = { };
				level.primitives.set(arg, next);
				return next;
			}
		}
	}, levelOne);

	const put = function(... args) {
		const value = args.pop();
		return findLevel(args).value = value;
	};
	const miss = function(...args) {
		return findLevel(args).value = compute.apply(this, args);
	};
	const hit = function(...args) {
		const cache = findLevel(args);
		console.log('cache', cache);
		return ('value' in cache) ? cache.value : miss;
	};

	return Object.assign(function cached(...args) {
		const cache = findLevel(args);
		console.log('cache', cache);
		if ('value' in cache) {
			return cache.value;
		}
		return cache.value = compute.apply(this, args);
	}, { hit, compute, put, miss, });
};

// alternative aproach (hash): map each arg value to a random and us their sum as the map key
// drawback: may collide, results won't be collected if all their args are
let objects = new WeakMap();
let primitives = new Map();
let hash = args => args.reduce((sum, arg) => {
	const map = (arg !== null && typeof arg === 'object') ? objects : primitives;
	if (map.has(arg)) {
		return map.get(arg) + sum;
	} else {
		const key = Math.random();
		map.set(arg, key);
		return key + sum;
	}
}, 0);
function Cache2(compute) {
	const cache = new Map();
	return function cached(...args) {
		const key = hash(args);
		if (cache.has(key)) {
			return cache.get(key);
		}
		const result = compute.apply(this, args);
		cache.set(key, result);
		return result;
	};
}

const moduleName = 'es6lib/functional'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
