'use strict';
/* global requireEs6 */

const { TemplateEngine, ForEach, ForOf, While, If, Value, Index, Key, Call, Predicate, End, NoMap, } = require('./../../template/engine.js');


const test = exports.test = () => new TemplateEngine(s => '['+ s +']')({ trim: 'empty', })`
beforestart ${ 'veryfirst' } docStart
${ ForEach('outer', ['first', 'second', 'third']) }
	1stLine ${ Value }
	${ ForEach('inner', ['alpa', 'betha', 'gamma']) }
		${ If(Predicate([Index('outer'), Index('inner')], (a, b) => (a == b))) }
			2ndLine ${ Value } 2ndEnd (${ Index('outer') })
		${ End.If }
		${ Predicate([Value('outer'), Value('inner')], (o, i) => o+i) }
		${ ForOf('reverse', { first: 'tsrif', second: 'dnoces', third: 'driht', }) }
			${ If(Predicate([Value('outer'), Key('reverse')], (v, k) => (v === k))) }
				key: ${ Key }, value: ${ Value }
			${ End.If }
		${ End.ForOf }
	${ End.ForEach }
	1stEnd
${ End.ForEach }
${ While(function*(){
	yield 1;
	yield 2;
	yield 3;
	return 'not iterated';
}) }
	${ Index }: ${ Value }
	${ If((v, i, a) => a[i-1]) }
		(prev: ${ Call((v, i, a) => a[i-1]) })
	${ End.If }
${ End.While }
<!-- ${ NoMap('just a unmapped value') } -->
docEnd ${ 'varylast' } afterend`;
