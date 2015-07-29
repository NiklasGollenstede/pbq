(function(exports) { 'use strict';

/**
 * ForEach control flow element, repeats all elements between this value and the corresponding
 * End value will be repeated as often as often as 'arrays' .forEach function will call a callback
 * @param {any}       name   identifier that can be used to get the right @see Index or @see Value in nested loops
 * @param {arraylike} array  the array or array like structure to iterate over, uses its .forEach function
 *                           while iterating, the forEach-callbacks second value will be the @see Index
 * @return {ControlFlowElement}  Object that starts the loop
 */
const ForEach = exports.ForEach = function ForEach(name, array) { return { command: ForEach, array: array || name, name }; };

/**
 * Same as @see ForEach, only that it uses Object.keys(object) to get ist's @see Index'es
 * @param {any}     name    identifier that can be used to get the right @see Index or @see Value in nested loops
 * @param {object}  object  Object that will be iterated over for every key in Object.keys(object)
 * @return {ControlFlowElement}  Object that starts the loop
 */
const ForOf = exports.ForOf = function ForOf(name, object) { return { command: ForOf, object: object || name, name }; };

/**
 * Loop while 'generator' yields values
 * @param {function*}  generator  generator function that will be iterated over
 *                                @see Index will be incremented at each call to the generator
 * @return {ControlFlowElement}  Object that starts the loop
 */
const While = exports.While = function While(generator) { return { command: While, generator, }; };

/**
 * If control flow element, include all elements between this and the corresponding End only if 'value' is true
 * or returns true, in case it's a function
 * @param {any|function|Predicate}   value  Block will be included if and only if value is trueisch.
 *                     If value is a function, it will be considered truisch if it returns a truisch value.
 *                     It will be called with (value, index, array) of the current iteration.
 *                     Same for Predicate, it will be called as specified, @see Predicate
 *                     Otherwise the value will be considered thueisch if !!value === true.
 * @return {ControlFlowElement}  Object that starts the if branch
 */
const If = exports.If = function If(value) { return { command: If, value, }; };

/**
 * Gets the value of ether the innermost or a named iteration
 * @param {any}  name  optional, name specified in the opening iteration value (which defaults to the array/object iterated over)
 * @return {ControlFlowElement}  Object that will be replaced by the value
 */
const Value = exports.Value = function Value(name) { return { command: Value, name, }; };

/**
 * Gets the index (or key) of ether the innermost or a named iteration
 * @param {any}  name  optional, name specified in the opening iteration value (which defaults to the array/object iterated over)
 * @return {ControlFlowElement}  Object that will be replaced by the index
 */
const Index = exports.Index = function Index(name) { return { command: Index, name, }; };

/**
 * Alias for Index
 */
const Key = exports.Key = Index;

/**
 * Callback will be called with (value, index, array) of the current iteration.
 * @param  {Function} callback the callback function
 * @return {ControlFlowElement}  Object that will be replaced by callback's return value
 */
const Call = exports.Call = function Call(callback) { return { command: Call, callback, }; };

/**
 * Specifies a (predicate) function that will be called with custom arguments
 * @param  {array of Value|Index}   args      will be mapped to values and indices according to @see Value and @see Index
 * @param  {Function}               callback  function that will be called with the mapped valued array as arguments
 * @param  {any}                    thisArg   this in callback
 * @return {ControlFlowElement}   Object that will be replaced by callback's return value
 */
const Predicate = exports.Predicate = function Predicate(args, callback, thisArg) { return { command: Predicate, values: args, callback, thisArg, }; };

/**
 * Ends a ControlFlowElement's branch
 * Using End's properties (ForEach/ForOf/While/If) introduces type safety and is encouraged.
 * @return {ControlFlowElement}  Object that ends the current branch
 */
const End = exports.End = (function(End) { return Object.freeze(Object.assign(End, {
	ForEach: { command: End, value: ForEach, },
	ForOf: { command: End, value: ForOf, },
	While: { command: End, value: While, },
	If: { command: End, value: If, },
})); })({ });

/**
 * Excludes a value from the mapping
 * @param {any}  value  value that will be directly used instead of beeing mapped
 */
const NoMap = exports.NoMap = function NoMap(value) { return { command: NoMap, value, }; };

/**
 * Creates a new template engine instance that can ether be called
 * as TemplateEngine(options) with (additional) Options
 * or as a template string processor (TemplateEngine`template${string}`).
 * So calling TemplateEngine(options)`template${string}` will process the string with the given options
 * @param {object|Function}   options   Object containing
 *                            @attribute {string}    trim    trimming options, may contain
 *                                             front     remove any whitespaces at the front of the result
 *                                             parts     remove many whritspaces before and after inserted values
 *                                             strong    remove more whritspaces before and after inserted values
 *                                             empty     remove any empty lines
 *                                             all       reduce all whitespace sequences to single ' ' (space) characters
 *                            @attribute {function}  mapper  function that all value parts of the result will b passed through
 *                                                           may receive any (single) value and shpould return a string
 * @param {Array, ...any}     strings, ...vars  arguments when called via TemplateEngine`template${string}`
 * @return {Function|string}  if called with options (with or without 'new') the same function with bound options
 *                            if called as template string function, the processed string
 */
const TemplateEngine = exports.TemplateEngine = function TemplateEngine(options) {
	const self = (this instanceof TemplateEngine) ? this : Object.create(TemplateEngine.prototype);

	// not called as template string processor (yet)
	if (!(Array.isArray(options) && arguments.length === options.length)) {
		// called with options
		if (typeof options === 'object') {
			self.options = Object.assign(self.options || { }, options);
		}
		// called with mapper function
		else if (typeof options === 'function') {
			self.options && (self.options.mapper = options) || (self.options = { mapper: options, });
		}
		else {
			throw new TypeError('Invalid arguments for TemplateEngine: '+ options +', and '+ (arguments.length - 1) +' more');
		}
		return TemplateEngine.bind(self);
	}

	const vars = new Array(arguments.length - 1);
	for (let i = 0, length = arguments.length - 1; i < length; ++i) {
		vars[i] = arguments[i + 1];
	}

	self.strings = options;
	self.vars = vars;
	self.parts = [ ];
	self.stack = [ self.stackBase, ];

	self.findBrackets();
	Object.freeze(self);
	self.processRange(0, vars.length);

	return self.result;
};
TemplateEngine.prototype = {
	stackBase: Object.freeze({ array: Object.freeze([ ]), index: -1, name: undefined, }),

	get result() {
		const parts = this.parts, mapper = this.options.mapper, trim = this.options.trim;
		parts.pop();

		const toBeMapped = [];
		if (typeof mapper === 'function') {
			const strings = new Set(this.strings);
			for (var i = 0; i < parts.length; ++i) {
				!strings.has(parts[i]) && toBeMapped.push(i);
			}
		}

		(/front/).test(trim) && (this.parts[0] = this.parts[0].replace(/^[ \t]*\n/, ''));
		(/(parts|strong)/).test(trim) && this.trim(trim);

		toBeMapped.forEach(function(index) {
			if (!(index in parts)) { return; }
			if (parts[index] && parts[index].command === NoMap) {
				parts[index] = parts[index].value;
			} else {
				parts[index] = mapper(parts[index]);
			}
		});

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
		(/strong/).test(level) && parts.forEach(function(part, index) {
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
		return this.stack.find(hasProperty('name', name));
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

	forEach(startIndex, element) {
		const array = element.array, name = element.name, stopIndex = element.closing;
		// console.log('_forEach', startIndex, array, stopIndex);

		const tupel = { array, name };
		this.stack.push(tupel);
		array.forEach(function(item, index) {
			tupel.index = index;
			this.processRange(startIndex + 1, stopIndex);
		}.bind(this));
		this.stack.pop();
		return stopIndex;
	},

	forOf(startIndex, element) {
		const object = element.object, name = element.name, stopIndex = element.closing;
		// console.log('_forOf', startIndex, array, stopIndex);

		const tupel = { array: object, name };
		this.stack.push(tupel);
		Object.keys(object).forEach(function(index) {
			tupel.index = index;
			this.processRange(startIndex + 1, stopIndex);
		}.bind(this));
		this.stack.pop();
		return stopIndex;
	},

	While(startIndex, element) {
		const generator = element.generator, name = element.name, stopIndex = element.closing;
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
		this.vars.forEach(function(value, index) {
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

	callPredicate(element) {
		const callback = element.callback, values = element.values, thisArg = element.thisArg;
		// console.log('stack', this.stack);
		return callback.apply(thisArg, values.map(function(value) {
			const tupel = this.stack.find(hasProperty('name', value.name));
			// console.log('tupel', tupel, value);
			if (value.command === Value) {
				return tupel.array[tupel.index];
			} else if (value.command === Index) {
				return tupel.index;
			}
			throw 'Predicats arguments must be Value or Index';
		}.bind(this)));
	},
};

// find/filter helper
function hasProperty(key, value) {
	return function(object) {
		return object[key] === value;
	};
}

const moduleName = 'es6lib/template/engine'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
