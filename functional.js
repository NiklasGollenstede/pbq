'use strict';

const noop = exports.noop = ((self = new Proxy(() => self, { get: () => self, set() { }, })) => self)();

const debugLog = exports.debugLog = function debugLog() {
	console.log.apply(console, arguments);
	return arguments[arguments.length - 1];
};

const now = (typeof performance !== 'undefined')
? performance.now.bind(performance) // browser
: require("chrome").Cu.now; // firefox
// node: ([s, ns] = process.hrtime()) => s * 1e9 + ns

const Timer = exports.Timer = function Timer(start = now()) {
	return (end = now()) => (end - start);
};

const Counter = exports.Counter = function Counter(c = 0) {
	return Object.assign(() => ++c, { get: () => c, });
};

const Logger = exports.Logger = function Logger(...outer) {
	return (...inner) => console.log(...outer, ...inner);
};

const blockEvent = exports.blockEvent = function blockEvent(event) {
	event.preventDefault();
	event.stopPropagation && event.stopPropagation();
};

const fuzzyMatch = exports.fuzzyMatch = function fuzzyMatch(s1, s2, n) {
	// algorythm: http://www.catalysoft.com/articles/StrikeAMatch.html
	n = (n>2) ? n : 2;
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
	return 2 * total / (l1 + l2);
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
