/*eslint strict: ["error", "global"], no-implicit-globals: "off", no-unused-expressions: "off"*/ 'use strict'; /* global assert, describe, it, beforeEach, afterEach, */ // license: MPL-2.0

describe('A Port should', () => {
	const Port = require('../port.js');

	const { PassThrough, } = require('stream');
	const { async, } = require('../concurrent.js');

	let port;

	beforeEach(() => {
		port = new Port(new PassThrough, Port.node_Stream);
	});

	afterEach(() => {
		port && port.destroy();
		port = null;
	});

	it('be destroyable', () => {
		port.destroy();
	});

	it('send post messages', () => {
		port.addHandler('foo', () => null);
		port.post('foo', 1, 2, 3);
	});

	it('revieve post messages', done => {
		const _this = { };
		port.addHandler('foo', function(_1, _2, _3) {
			assert(this === _this, 'bad this'); // eslint-disable-line no-invalid-this
			assert(_1 === 1, 'bad arg');
			assert(_2 === 2, 'bad arg');
			assert(_3 === 3, 'bad arg');
			done();
		}, _this);
		port.post('foo', 1, 2, 3);
	});

	it('process requests', async(function*() {
		port.addHandler('foo', (_1, _2, _3) => _1 + _2 + _3);
		(yield port.request('foo', 1, 2, 3).should.eventually.equal(1 + 2 + 3));
	}));

	it('report errors from requests', async(function*() {
		port.addHandler('foo', () => { throw new TypeError; });
		(yield port.request('foo', 1, 2, 3).then(_=>null, _=>_).should.eventually.be.instanceof(TypeError));
	}));
});
