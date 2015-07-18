'use strict';

const Marker = exports.Marker = require('./namespace.js').Marker;

const inWidth = exports.inWidth = function inWidth(node, cb, mark) {
	mark = mark || new Marker();
	let queue = [ node ];
	const used = function(node) { !mark(node); };
	let i = 0; do {
		!mark(queue[i], true) && (queue = queue.concat(queue[i].filter(used)));
	} while (++i < queue.length);
	queue.forEach(cb);
};

const inDepth = exports.inDepth = function inDepth(node, cb, mark) {
	mark = mark || new Marker();
	!mark(node, true) && cb(node) === node.forEach(function(node) { inDepth(node, cb, mark); });
};

const inDepthAsync = (node, cb, mark) => new Promise(function(resolve, reject) {
	mark = mark || new Marker();
	const doIt = node => { try { (!mark(node, true)) && cb(node) === node.forEach(
		node => process.nextTick(doIt.bind(null, node))
	); } catch (e) { reject(e); } };
	process.nextTick(doIt.bind(null, node));
	setImmediate(resolve);
});


const arraySpliceSequence = exports.arraySpliceSequence = function arraySpliceSequence(before, after) {
	before = before.slice(); after = after.slice();
	let changes = [];
	for (let i = 0; i < before.length; i++) { // remove
		if (after.indexOf(before[i]) == -1) {
			changes.push([i, 1, ]);
			before.splice(i, 1);
			--i;
		}
	}
	for (let i = 0; i < after.length; i++) { // insert
		if (before.indexOf(after[i]) == -1) {
			changes.push([i, 0, after[i]]);
			before.splice(i, 0, after[i]);
		}
	}
	let reverse = [];
	let most, value, beforeIndex, afterIndex;
	while(true) { // move
		// find the item that was moved the most, while such exists
		most = 0; value = beforeIndex = afterIndex = undefined;
		for (let i = 0; i < before.length; i++) {
			let index = after.indexOf(before[i]);
			let move = Math.abs(i - index);
			if (move > most) {
				most = move;
				value = before[i];
				beforeIndex = i;
				afterIndex = index;
			}
		}
		// console.log(JSON.stringify(before), JSON.stringify(after), beforeIndex, afterIndex, value);
		if (value === undefined) { break; } // no (more) moves
		changes.push([beforeIndex, 1, ]);
		before.splice(beforeIndex, 1);
		reverse.push([afterIndex, 0, value]);
		after.splice(afterIndex, 1);
	}
	for (let i = reverse.length - 1; i >= 0; i--) {
		changes.push(reverse[i]);
	}
	return changes;
};

const applySpliceSequence = exports.applySpliceSequence = function applySpliceSequence(array, sequence) {
	sequence.forEach(array.splice.apply.bind(array.splice, array));
	return array;
};

const testSpliceSequence = function(turns, size, removes, inserts, moves) {
	let uniqueValue = function(array, value) { return ((value +1) && array.indexOf(value) == -1) ? value : uniqueValue(array, Math.floor(Math.random() * size * 2)); };
	let totalChanges = 0, fails = [], results = [];
	for (let turn = 0; turn < turns; turn++) {
		let before = [];
		for (let i = 0; i < size; i++) { before.push(uniqueValue(before)); }
		let after = before.slice();
		for (let remove = 0; remove < removes; remove++) {
			after.splice(Math.floor(Math.random() * after.length), 1);
		}
		for (let insert = 0; insert < inserts; insert++) {
			after.splice(Math.floor(Math.random() * after.length), 0, uniqueValue(after));
		}
		for (let move = 0; move < moves; move++) {
			let item = after.splice(Math.floor(Math.random() * after.length), 1)[0];
			after.splice(Math.floor(Math.random() * after.length), 0, item);
		}
		let changes = arraySpliceSequence(before, after);
		let changed = applySpliceSequence(before.slice(), changes);
		let isSame = after.length == changed.length && after.every(function(value, index) { return value == changed[index]; });
		results.push([changes, JSON.stringify(before), JSON.stringify(after), isSame ? "same" : JSON.stringify(changed)]);
		!isSame && fails.push([changes, JSON.stringify(before), JSON.stringify(after), JSON.stringify(changed)]);
		totalChanges += changes.length;
	}
	console.log("Ran "+ turns +" tests with "+ size +" elements. Expected "+ ((removes+inserts+moves*2) * turns).toLocaleString() +" changes, got "+ totalChanges.toLocaleString() +".");
	fails.length && console.error("Errors", fails);
	return results;
};
