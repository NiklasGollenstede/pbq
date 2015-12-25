'use strict';

const concurrent = require('../concurrent.js');
	const promisify = concurrent.promisify;
	const promised = concurrent.promised;
	const spawn = concurrent.spawn;
	const async = concurrent.async;
	const StreamIterator = concurrent.StreamIterator;
	const forOn = concurrent.forOn;
	const sleep = concurrent.sleep;

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

const EvebtEmitter = require('events');

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

	it('mind timing', () => {
		let closure = NaN;
		const ret = sut(function*() {
			(yield sleep(2));
			closure++;
			(yield sleep(4));
			return closure;
		}).should.become(2);
		closure = 0;
		setTimeout(() => closure++, 4);
		return ret;
	});

	it('work', () => {
		const values = [ 'a', 1, null, true, { }, String('blob'), ];
		return sut(pointlessGenerator, null, [ values, ]).should.become(values);
	});

});

describe('"StreamIterator" should', () => {

	it('directly end on end', async(function*() {
		const emitter = new EvebtEmitter, values = [ ];
		const sut = StreamIterator(emitter);

		emitter.emit('end', 'blob');

		const promise = spawn(function*() {
			let pair; while ((pair = sut.next()) && !pair.done) {
				values.push((yield pair.value));
			}
			return true;
		});

		(yield promise).should.equal(true);

		values.should.deep.equal([ 'blob', ]);
	}));

	it('iterate data and end events', async(function*() {
		const emitter = new EvebtEmitter, values = [ ];
		const sut = StreamIterator(emitter);

		const promise = spawn(function*() {
			let pair; while ((pair = sut.next()) && !pair.done) {
				values.push((yield pair.value));
			}
			return true;
		});

		emitter.emit('data', 1);
		emitter.emit('data', 2);
		setTimeout(() => {
			emitter.emit('data', 3);
			emitter.emit('data', 4);
		});
		setTimeout(() => {
			emitter.emit('data', 5);
			emitter.emit('data', 6);
			emitter.emit('end', 7);
		}, 3);

		(yield promise).should.equal(true);

		values.should.deep.equal([ 1, 2, 3, 4, 5, 6, 7, ]);
	}));

});

describe('"forOn" should', () => {
	const sut = forOn;

	it('directly return on end', async(function*() {
		const emitter = new EvebtEmitter, values = [ ];
		const promise = sut(StreamIterator(emitter), value => values.push(value));

		emitter.emit('end');

		(yield promise).should.equal(true);
		values.should.deep.equal([ ]);
	}));

	it('directly throw on error', async(function*() {
		const emitter = new EvebtEmitter, values = [ ];
		const promise = sut(StreamIterator(emitter), value => values.push(value));

		emitter.emit('error', 17);

		let cought;
		(yield promise.catch(error => cought = error));
		cought.should.equal(17);

		values.should.deep.equal([ ]);
	}));

	it('throw on error later on', async(function*() {
		const emitter = new EvebtEmitter, values = [ ];
		const promise = sut(StreamIterator(emitter), value => values.push(value));

		emitter.emit('data', -1);
		emitter.emit('data', -2);
		emitter.emit('error', 17);

		let cought;
		(yield promise.catch(error => cought = error));
		cought.should.equal(17);

		values.should.deep.equal([ -1, -2, ]);
	}));

	it('directly rethrow', async(function*() {
		const emitter = new EvebtEmitter, values = [ ];
		const promise = sut(StreamIterator(emitter), value => { throw 23; });

		emitter.emit('data', 42);

		let cought;
		(yield promise.catch(error => cought = error));
		cought.should.equal(23);

		values.should.deep.equal([ ]);
	}));

	it('iterate data and end events', async(function*() {
		const emitter = new EvebtEmitter, values = [ ];
		const promise = sut(StreamIterator(emitter), value => values.push(value));

		emitter.emit('data', 1);
		emitter.emit('data', 2);
		setTimeout(() => {
			emitter.emit('data', 3);
			emitter.emit('data', 4);
		});
		setTimeout(() => {
			emitter.emit('data', 5);
			emitter.emit('data', 6);
			emitter.emit('end', 7);
		}, 3);

		(yield promise).should.equal(true);

		values.should.deep.equal([ 1, 2, 3, 4, 5, 6, 7, ]);
	}));

});
