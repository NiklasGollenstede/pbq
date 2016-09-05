'use strict'; /* global assert, describe, expect, it, xit */

const {
	functional: { log, },
	format: { RegExpX, numberToRoundString, }
} = require('../');


describe('"RegExpX" should', function() {

	it('remove comments', () => {
		RegExpX`#`.should.deep.equal(new RegExp(''));
		RegExpX`a#b`.should.deep.equal((/a/));
		(() => RegExpX`[a#b]{10}`).should.throw(SyntaxError);
	});

	it('keep escaped comments', () => {
		RegExpX`\#`.should.deep.equal((/#/));
		RegExpX`\#\#\#\\\\\#`.should.deep.equal((/###\\\\#/));
		RegExpX`a\#b`.should.deep.equal((/a#b/));
		RegExpX`[a\#b]{10}`.should.deep.equal((/[a#b]{10}/));
	});

	it('remove comments after escaped comments', () => {
		RegExpX`\##`.should.deep.equal((/#/));
		RegExpX`\#a#b`.should.deep.equal((/#a/));
		RegExpX`\\\#a\\#b`.should.deep.equal((/\\#a\\/));
		RegExpX`\\\#a\\\\#b`.should.deep.equal((/\\#a\\\\/));
		RegExpX`\\\\\\\#a\\\\#b`.should.deep.equal((/\\\\\\#a\\\\/));
		(() => RegExpX`\#[a#b]{10}`).should.throw(SyntaxError);
		(() => RegExpX`\#[a\\\\#b]{10}`).should.throw(SyntaxError);
	});

	it('strip whitespaces', () => {
		RegExpX` `.should.deep.equal(new RegExp(''));
		RegExpX`
		`.should.deep.equal(new RegExp(''));
		RegExpX`a bc\\	d`.should.deep.equal((/abc\\d/));
		RegExpX`a
		`.should.deep.equal((/a/));
	});

	it('keep escaped whitespaces', () => {
		RegExpX`\ `.should.deep.equal((/ /));
		RegExpX`\\\\\ `.should.deep.equal((/\\\\ /));
		RegExpX`\\\\\ \\	`.should.deep.equal((/\\\\ \\/));
		RegExpX`a\ b`.should.deep.equal((/a b/));
		RegExpX`[a\ b]{10}`.should.deep.equal((/[a b]{10}/));
	});

	it('find flags', () => {
		RegExpX`a/i`.should.deep.equal((/a/i));
		RegExpX`a\/b/i`.should.deep.equal((/a\/b/i));
		RegExpX`a\/b\\\\/i`.should.deep.equal((/a\/b\\\\/i));
		RegExpX`a\/b # comment
		/igm # flags`.should.deep.equal((/a\/b/igm));
	});

	it('work', () => {
		RegExpX`
			[\n\ ] # newline or space
			\/ # an escaped slash
			\# # '#'-char
			\# not a comment # but this is
			/g # flags
		`.should.deep.equal((/[\n ]\/##notacomment/g));

		RegExpX`^(
			 \d\d\d\d (- W[0-5]?\d)?                          # years + optional weeks
			|\d\d\d\d  - [0-1]?\d (- [0-3]?\d)?               # years + months + optional days
			|            [0-1]?\d  - [0-3]?\d                 # months + days
			|\d\d\d\d  - [0-1]?\d  - [0-3]?\d [T\ ] [0-2]?\d : [0-6]\d (: [0-6]\d (\. \d\d?\d?)?)? ([Z] | [+-] [0-2]?\d : [0-6]\d)? # TODO timezone other then 'Z'
			    # years + months + days + hours + minutes + optional seconds and milliseconds + optional time zone
			|[0-2]?\d : [0-6]\d ( [+-] [0-2]?\d : [0-6]\d)?   # hours + minutes + optional time zone (hh:mm)
			|P \d+ D                                          # duration in days
			|PT \d+ H (\d+ M (\d+ S)?)?                       # duration in hours + minutes + seconds
			# TODO: check duration
		)$`.should.deep.equal((/^(\d\d\d\d(-W[0-5]?\d)?|\d\d\d\d-[0-1]?\d(-[0-3]?\d)?|[0-1]?\d-[0-3]?\d|\d\d\d\d-[0-1]?\d-[0-3]?\d[T ][0-2]?\d:[0-6]\d(:[0-6]\d(\.\d\d?\d?)?)?([Z]|[+-][0-2]?\d:[0-6]\d)?|[0-2]?\d:[0-6]\d([+-][0-2]?\d:[0-6]\d)?|P\d+D|PT\d+H(\d+M(\d+S)?)?)$/));

		RegExpX`^(
			((http s? | mailto) \:\/\/)? [
				\# \@ \& \= \+ \$ \, \/ \?   # reserved    # not used:  \! \* \' \( \) \; \: \[ \]
				\- \_ \. \~ \w               # unreserved
				\%
			]*
		)$`.should.deep.equal((/^(((https?|mailto)\:\/\/)?[#\@\&\=\+\$\,\/\?\-\_\.\~\w\%]*)$/));

		var newLine = '[\\r\\n]';
		var sentence = /([\w\.\ 0-9]*)/gim;
		RegExpX`(${ sentence } (<br><\/br>)+ ${ newLine })+`.should.deep.equal((/(([\w\. 0-9]*)(<br><\/br>)+[\r\n])+/));
	});

});

describe('"numberToRoundString" should', function() {

	it('work', () => {
		numberToRoundString(+1.23e1, 3).should.equal( '12.3');
		numberToRoundString(-1.23e1, 3).should.equal('-12.3');

		numberToRoundString(+1.23e2, 3).should.equal( '123');
		numberToRoundString(-1.23e2, 3).should.equal('-123');

		numberToRoundString(+1.23e3, 3).should.equal( '1.23k');
		numberToRoundString(-1.23e3, 3).should.equal('-1.23k');

		numberToRoundString(+1.23e5, 3).should.equal( '123k');
		numberToRoundString(-1.23e5, 3).should.equal('-123k');

		numberToRoundString(+1.23e7, 3).should.equal( '12.3M');
		numberToRoundString(-1.23e7, 3).should.equal('-12.3M');

		numberToRoundString(+1.23e9, 3).should.equal( '1.23G');
		numberToRoundString(-1.23e9, 3).should.equal('-1.23G');

		numberToRoundString(+1.23e-1, 3).should.equal( '123m');
		numberToRoundString(-1.23e-1, 3).should.equal('-123m');

		numberToRoundString(+1.23e-3, 3).should.equal( '1.23m');
		numberToRoundString(-1.23e-3, 3).should.equal('-1.23m');

		numberToRoundString(+1.23e-6, 3).should.equal( '1.23µ');
		numberToRoundString(-1.23e-6, 3).should.equal('-1.23µ');

		numberToRoundString(+1.2345678e4, 6).should.equal( '12.3456k');
		numberToRoundString(-1.2345678e4, 6).should.equal('-12.3456k');

	});
});
