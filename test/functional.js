'use strict';

const { noop, apply, } = require('../functional.js');

(noop ? describe : xdescribe)('"noop" should', () => {
	const sut = noop;

	it('always stay noop', () => {
		assert(sut() === sut, 'call');
		assert(sut.blob === sut, 'property');
		assert(sut.blob() === sut, 'member');
	});

	it('not be modified', () => {
		sut.blob = 42;
		assert(sut.blob === sut, 'immutable');
	});

	xit('be falsy', () => {
		assert(sut == false, 'is false');
		assert(!sut == true, 'negates to true');
		assert(+sut == NaN, 'is NaN');
		assert(''+ sut == '', 'is ""');
	});

});

describe('"apply" should', function() {
	const sut = apply;

	function concat(...args) {
		args.unshift(this);
		return args;
	}

	it('call correctly', () => {
		sut(concat).should.deep.equal([ undefined, ]);
		sut(concat, this).should.deep.equal([ this, ]);

		sut(concat, null, [ ]).should.deep.equal([ undefined, ]);
		sut(concat, this, [ ]).should.deep.equal([ this, ]);
		sut(concat, null, [ 1, ]).should.deep.equal([ null, 1, ]);
		sut(concat, this, [ 1, ]).should.deep.equal([ this, 1, ]);
		sut(concat, null, [ 1, 2, ]).should.deep.equal([ null, 1, 2, ]);
		sut(concat, this, [ 1, 2, ]).should.deep.equal([ this, 1, 2, ]);
		sut(concat, null, [ 1, 2, 3, ]).should.deep.equal([ null, 1, 2, 3, ]);
		sut(concat, this, [ 1, 2, 3, ]).should.deep.equal([ this, 1, 2, 3, ]);
		sut(concat, null, [ 1, 2, 3, 4, ]).should.deep.equal([ null, 1, 2, 3, 4, ]);
		sut(concat, this, [ 1, 2, 3, 4, ]).should.deep.equal([ this, 1, 2, 3, 4, ]);
		sut(concat, null, [ 1, 2, 3, 4, 5, 6, ]).should.deep.equal([ null, 1, 2, 3, 4, 5, 6, ]);
		sut(concat, this, [ 1, 2, 3, 4, 5, 6, ]).should.deep.equal([ this, 1, 2, 3, 4, 5, 6, ]);

		sut(concat, null, [ ], 42).should.deep.equal([ null, 42, ]);
		sut(concat, this, [ ], 42).should.deep.equal([ this, 42, ]);
		sut(concat, null, [ 1, ], 42).should.deep.equal([ null, 1, 42, ]);
		sut(concat, this, [ 1, ], 42).should.deep.equal([ this, 1, 42, ]);
		sut(concat, null, [ 1, 2, ], 42).should.deep.equal([ null, 1, 2, 42, ]);
		sut(concat, this, [ 1, 2, ], 42).should.deep.equal([ this, 1, 2, 42, ]);
		sut(concat, null, [ 1, 2, 3, ], 42).should.deep.equal([ null, 1, 2, 3, 42, ]);
		sut(concat, this, [ 1, 2, 3, ], 42).should.deep.equal([ this, 1, 2, 3, 42, ]);
		sut(concat, null, [ 1, 2, 3, 4, ], 42).should.deep.equal([ null, 1, 2, 3, 4, 42, ]);
		sut(concat, this, [ 1, 2, 3, 4, ], 42).should.deep.equal([ this, 1, 2, 3, 4, 42, ]);
		sut(concat, null, [ 1, 2, 3, 4, 5, 6, ], 42).should.deep.equal([ null, 1, 2, 3, 4, 5, 6, 42, ]);
		sut(concat, this, [ 1, 2, 3, 4, 5, 6, ], 42).should.deep.equal([ this, 1, 2, 3, 4, 5, 6, 42, ]);
	});

}.bind({ self: Symbol(), }));
