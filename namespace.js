'use strict';

export function NameSpace() {
	const map = new WeakMap();
	return function(key) {
		let value = map.get(key);
		if (value === undefined) {
			map.set(key, value = { });
		}
		return value;
	};
}

export function IterableNameSpace() {
	const map = new Map();
	return Object.assign(key => {
		let value = map.get(key);
		if (value === undefined) {
			map.set(key, value = { });
		}
		return value;
	}, {
		forEach: map.forEach.bind(map),
		destroy: map.clear.bind(map),
	});
}

export function Marker() {
	const map = new WeakMap();
	return (key, ...now) => {
		const old = map.get(key);
		now.length && map.set(key, now[0]);
		return old;
	};
}
