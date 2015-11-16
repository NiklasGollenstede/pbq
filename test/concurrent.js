'use strict';

const { promisify, promised, spawn, } = require('../concurrent.js');

function nodeReturn(value, callback) {
	callback(null, value, 'ignored');
}

function nodeReturnThis(callback) {
	callback(null, this, 'ignored');
}

function nodeThrow(error, callback) {
	callback(error, 'ignored');
}

function promiseReturn(value) {
	return new Promise((resolve, reject) => resolve(value));
}

function promiseReturnThis() {
	return new Promise((resolve, reject) => resolve(this));
}

function promiseThrow(error) {
	return new Promise((resolve, reject) => reject(error));
}

function* pointlessGenerator(values) {
	values = values.map((value, index) => index % 2 ? promiseReturn(value) : promiseThrow(value));
	const out = [ ];
	for (let promise of values) {
		try {
			out.push(yield promise);
		} catch (error) {
			out.push(error);
		}
	}
	return out;
}

describe('"promisify"ed should', () => {
	const sut = promisify;

	it('return', () => {
		return sut(nodeReturn)(42).should.eventually.equal(42);
	});

	it('forward `this´', () => {
		return sut(nodeReturnThis).call(42).should.eventually.equal(42);
	});

	it('throw', () => {
		return sut(nodeThrow)(42).should.be.rejectedWith(42);
	});

});

describe('"promised"ed should', () => {
	const sut = promised;

	it('return', done => {
		function callback(error, value) {
			if (error) { return done(error); }
			value.should.equal(42);
			done();
		}
		sut(promiseReturn)(42, callback);
	});

	it('forward `this´', done => {
		function callback(error, value) {
			if (error) { return done(error); }
			value.should.equal(42);
			done();
		}
		sut(promiseReturnThis).call(42, callback);
	});

	it('throw', done => {
		function callback(error, value) {
			error.should.equal(42);
			done();
		}
		sut(promiseThrow)(42, callback);
	});

});

describe('"spawn"ed should', () => {
	const sut = spawn;

	it('directly return', () => {
		return sut(function*() { return 23; }).should.become(23);
	});

	it('directly throw', () => {
		return sut(function*() { throw 23; }).should.rejectedWith(23);
	});

	it('be async', () => {
		let closure = false;
		const ret = sut(function*() { return closure; }).should.become(true);
		closure = true;
		return ret;
	});

	it('work', () => {
		const values = [ 'a', 1, null, true, { }, String('blob'), ];
		return sut(pointlessGenerator, null, [ values, ]).should.become(values);
	});

});
