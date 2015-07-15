'use strict';
(function(exports) {

const ForEach = exports.ForEach = function ForEach(name, array) { return { command: ForEach, array: array || name, name }; };
const ForOf = exports.ForOf = function ForOf(name, object) { return { command: ForOf, object: object || name, name }; };
const While = exports.While = function While(generator) { return { command: While, generator, }; };
const If = exports.If = function If(value) { return { command: If, value, }; };

const Value = exports.Value = function Value(name) { return { command: Value, name, }; };
const Index = exports.Index = function Index(name) { return { command: Index, name, }; };
const Key = exports.Key = Index;

const Call = exports.Call = callback => ({ command: Call, callback, });
const Predicate = exports.Predicate = (values, callback) => ({ command: Predicate, values, callback, });

const End = exports.End = ((End = { }) => Object.freeze(Object.assign(End, {
	ForEach: { command: End, value: ForEach, },
	ForOf: { command: End, value: ForOf, },
	While: { command: End, value: While, },
	If: { command: End, value: If, },
})))();

const TemplateEngine = exports.TemplateEngine = function TemplateEngine(strings, ...vars) {
	const self = (this instanceof TemplateEngine) ? this : Object.create(TemplateEngine.prototype);

	// not called as template string processor (yet)
	if (!(Array.isArray(strings) && vars.length === strings.length - 1)) {
		// called with options
		if (typeof strings === 'object') {
			self.options = Object.assign(self.options || { }, strings);
		}
		// called with mapper function
		else if (typeof strings === 'function') {
			self.options && (self.options.mapper = strings) || (self.options = { mapper: strings, });
		}
		else {
			throw new TypeError('Invalid arguments for TemplateEngine: '+ strings +', '+ vars.join(', '));
		}
		return TemplateEngine.bind(self);
	}

	self.strings = strings;
	self.vars = vars;
	self.parts = [ ];
	self.stack = [ self.stackBase, ];

	self.findBrackets();
	Object.freeze(self);
	self.processRange(0, vars.length);

	return self.result; // string + new problem ??
};
TemplateEngine.prototype = {
	stackBase: Object.freeze({ array: Object.freeze([ ]), index: -1, name: undefined, }),

	get result() {
		const { parts, options: { mapper, trim, }, } = this;
		parts.pop();

		const toBeMapped = [];
		if (typeof mapper === 'function') {
			const strings = new Set(this.strings);
			for (var i = 0; i < parts.length; ++i) {
				!strings.has(parts[i]) && toBeMapped.push(i);
			}
		}

		(/front/).test(trim) && (this.parts[0] = this.parts[0].replace(/^[ \t]*\n/, ''));
		(/parts/).test(trim) && this.trim(trim);

		toBeMapped.forEach(index => index in parts && (parts[index] = mapper(parts[index])));

		let result = this.parts.join('');

		((/empty/).test(trim) && (result = result.replace(/\n([ \t]*\n)+/g, '\n')))
		|| ((/all/).test(trim) && (result = result.replace(/[ \t\n]+/g, ' ')));

		return result;
	},

	trim(level) {
		let parts = this.parts;
		let trimFront = (/^[ \t]*\n/);
		let trimBack = (/[ \t]*$/);
		let atFront = trimFront;
		let atBack = (/\n[ \t]*$/);
		let whitespace = (/^[ \t]*$/);
		for (let i = 1, l = parts.length; i < l; ++i) {
			if (atBack.test(parts[i - 1]) && atFront.test(parts[i])) {
				parts[i - 1] = parts[i - 1].replace(trimBack, '');
				parts[i] = parts[i].replace(trimFront, '');
			}
		}
		(/strong/).test(level) && parts.forEach((part, index) => {
			if ((part === '' || whitespace.test(part)) && atBack.test(parts[index - 1]) && atFront.test(parts[index + 1])) {
				parts[index + 1] = parts[index + 1].replace(trimFront, '');
				delete parts[index];
			}
		});
	},

	top() {
		return this.stack[this.stack.length - 1];
	},

	find(name) {
		return this.stack.find(tupel => tupel.name === name);
	},

	processRange(startIndex, endIndex) {
		// console.log('_processRange', startIndex, endIndex, this.top());

		let loopIndex = startIndex;
		do {
			// console.log('loop', loopIndex, this.vars[loopIndex]);

			this.parts.push(this.strings[loopIndex]);

			const current = this.vars[loopIndex];
			const top = this.top();

			if (!current) {
				this.parts.push(current);
			} else
			if (current.command === End) {
				// this.parts.push('');
			} else
			if (current === Value) {
				this.parts.push(top.array[top.index]);
			} else
			if (current === Index) {
				this.parts.push(top.index);
			} else {
				if (current.command === ForEach) {
					loopIndex = this.forEach(loopIndex, current);
				} else
				if (current.command === ForOf) {
					loopIndex = this.forOf(loopIndex, current);
				} else
				if (current.command === While) {
					loopIndex = this.While(loopIndex, current);
				} else
				if (current.command === If) {
					if ((
							!current.value
						) || (
							(typeof current.value === 'function')
							&& !current.value(top.array[top.index], top.index, top.array)
						) || (
							current.value && current.value.command === Predicate
							&& !this.callPredicate(current.value)
						)
					) { // skip ...
						loopIndex = current.closing;
					}
				} else if (current.command === Call) {
					this.parts.push(current.callback(top.array[top.index], top.index, top.array));
				} else if (current.command === Predicate) {
					this.parts.push(this.callPredicate(current));
				} else if (current.command === Value) {
					const tupel = this.find(current.name);
					this.parts.push(tupel.array[tupel.index]);
				} else if (current.command === Index) {
					this.parts.push(this.find(current.name).index);
				} else {
					this.parts.push(current);
				}
			}
		} while (++loopIndex <= endIndex);
	},

	forEach(startIndex, { array, name, closing: stopIndex, }) {
		// console.log('_forEach', startIndex, array, stopIndex);

		const tupel = { array, name };
		this.stack.push(tupel);
		array.forEach((item, index) => {
			tupel.index = index;
			this.processRange(startIndex + 1, stopIndex);
		});
		this.stack.pop();
		return stopIndex;
	},

	forOf(startIndex, { object, name, closing: stopIndex, }) {
		// console.log('_forOf', startIndex, array, stopIndex);

		const tupel = { array: object, name };
		this.stack.push(tupel);
		Object.keys(object).forEach((index) => {
			tupel.index = index;
			this.processRange(startIndex + 1, stopIndex);
		});
		this.stack.pop();
		return stopIndex;
	},

	While(startIndex, { generator, name, closing: stopIndex, }) {
		// console.log('_while', startIndex, generator, stopIndex);

		const top = this.top();
		const array = [];
		const tupel = { array, name, index: -1, };
		this.stack.push(tupel);
		for (let value of generator(top.array[top.index], top.index, top.array)) {
			array.push(value);
			tupel.index++;
			this.processRange(startIndex + 1, stopIndex);
		}
		this.stack.pop();
		return stopIndex;
	},

	findBrackets() {
		const stack = [];
		this.vars.forEach((value, index) => {
			if (!value) { return; }
			if (~[ ForEach, ForOf, While, If, ].indexOf(value.command)) {
				stack.push(value);
			} else
			if (value === End) {
				let top = stack.pop();
				if (!top) { throw Error('unexpected End: value '+ index); }
				top.closing = index;
			} else
			if (value.command === End) {
				let top = stack.pop();
				if (!top) { throw Error('unexpected End: value '+ index +' saw '+ value.value.name); }
				if (value.value === top.command) {
					top.closing = index;
				} else {
					throw Error('End mismatch: value '+ index +' expected '+ top.command.name +' saw '+ value.value.name);
				}
			}
		});
		if (stack.length) { throw Error('expected End: for '+ stack.pop().command.name +' saw <nothing>'); }
	},

	callPredicate({callback, values, }) {
		// console.log('stack', this.stack);
		return callback(...values.map(value => {
			const tupel = this.stack.find(tupel => tupel.name === value.name);
			// console.log('tupel', tupel, value);
			if (value.command === Value) {
				return tupel.array[tupel.index];
			} else if (value.command === Index) {
				return tupel.index;
			}
			throw 'Predicats arguments must be Value or Index';
		}));
	},
};

return Object.freeze(exports);
})((typeof exports !== 'undefined') ? exports : ((typeof window !== 'undefined') ? window.TemplateEngine = { } : { }));
