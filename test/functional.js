'use strict'; /* global assert, describe, expect, it, xit */

describe('"noop" should', () => {

	const { noop, } = require('../functional.js');

	it('always stay noop', () => {
		assert(noop() === noop, 'call');
		assert(noop.apply(null, [ ]) === noop, 'apply');
		assert(new noop === noop, 'new');
		assert(Reflect.construct(noop, [ ]) === noop, 'constuct');
		assert(noop.blob === noop, 'property');
		assert(noop.prototype === noop, '.prototype');
		assert(noop.blob() === noop, 'member');
		assert(noop[Symbol()] === noop, 'Symbol() property');
	});

	it('not be modified', () => {
		noop.blob = 42;
		expect(noop.blob).to.equal(noop);
		Object.defineProperty(noop, 'blob', { vlaue: 42, });
		expect(noop.blob).to.equal(noop);
		(() => Object.defineProperty(noop, 'arguments', { vlaue: 42, })).should.not.throw();
	});

	it('not be freezable', () => {
		(() => Object.freeze(noop)).should.throw(TypeError);
	});

	it('cast to falsy primitives', () => {
		expect(+noop).to.be.NaN;
		expect(''+ noop).to.equal('');
	});

	it('have a special Object.prototype.toString', () => {
		expect(Object.prototype.toString.call(noop)).to.equal('[object no-op]');
	});

	it('have only deletable properties', () => {
		(() => delete noop.blob).should.not.throw(); // throws in node 6.2.2, but shouldn't
		(() => delete noop.arguments).should.not.throw();
	});

	it('have the imutable .__proto__ == null', () => {
		expect(Object.getPrototypeOf(noop)).to.be.null;
		expect(noop.__proto__).to.be.null;
		Object.setPrototypeOf(noop, Object.prototype);
		expect(Object.getPrototypeOf(noop)).to.be.null;
		expect(noop.__proto__).to.be.null;
	});

	it('have no enumerable properties', () => {
		expect(Object.keys(noop).length).to.equal(0);
	});

	it('have no property descriptors', () => {
		expect(Object.getOwnPropertyDescriptor(noop, 'blob')).to.be.undefined;
		expect(Object.getOwnPropertyDescriptor(noop, 'caller')).to.be.undefined;
		expect(Object.getOwnPropertyDescriptor(noop, 'arguments')).to.be.undefined;
		expect(Object.getOwnPropertyDescriptor(noop, 'prototype')).to.be.undefined;
	});

	it('not have anything ``in´´ it', () => {
		expect('blob' in noop).to.be.false;
		expect('caller' in noop).to.be.false;
		expect('arguments' in noop).to.be.false;
		expect('prototype' in noop).to.be.false;
	});

});

describe('"apply" should', function() {
	const sut = require('../functional.js').apply;

	function concat(/*...*/args) {
		args = Array.prototype.slice.call(arguments);
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
