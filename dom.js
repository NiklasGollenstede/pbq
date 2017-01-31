(function(global) { 'use strict'; const factory = function es6lib_dom(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * The functions in this module use the global windows context (document, URL, self, top, etc.) by default.
 * To have any of the functions of this module operate on a different scope, call them with that scope as this,
 * e.g. `cerateElement.call(iframe.contentWindow, 'a', { ...});` to create an Element in an iframe.
 */
exports.window = global.window;
/* eslint-disable no-invalid-this */

/**
 * Returns true, if the current execution context is not a browser top level context.
 * I.e the current script is executed in an iframe.
 */
exports.inIframe = inIframe; function inIframe() {
	try { return ((this || global).window.self !== (this || global).window.top); } catch (e) { return true; }
}

/**
 * Creates a DOM Element and sets properties/attributes and children.
 * @param  {string}          tagName     Type of the new Element to create.
 * @param  {object}          properties  Optional. Object (not Array) of properties, which are deeply copied onto the new element.
 * @param  {Array(Element)}  childList   Optional. Array of elements or strings to set as the children of the new element.
 * @return {Element}                     The new DOM element.
 */
exports.createElement = createElement; function createElement(tagName, properties, childList) {
	const document = (this || global).window.document;
	const element = document.createElement(tagName);
	if (Array.isArray(properties)) { childList = properties; properties = null; }
	properties && deepAssign(element, properties);
	if (!childList) { return element; }
	for (const child of childList) {
		child && element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
	}
	return element;
}

function deepAssign(target, source) {
	Object.keys(source).forEach(key => {
		const value = source[key], now = target[key];
		if (typeof value === 'object' && (typeof now === 'object' || typeof now === 'function')) {
			deepAssign(now, value);
		} else {
			target[key] = value;
		}
	});
}

/**
 * Creates a new style Element of the given css string.
 */
exports.createStyleElement = createStyleElement; function createStyleElement(css) {
	const element = (this || global).window.document.createElement("style");
	element.type = "text/css";
	element.textContent = css;
	return element;
}

/**
 * Adds a css string to the document.
 * @param {string}  css  Style to add to the end of the document head.
 * @return {Element}     The new style Element.
 */
exports.addStyle = addStyle; function addStyle(css) {
	return (this || global).window.document.querySelector("head").appendChild(createStyleElement(css));
}

/**
 * Triggers a 'click' event on a DOM Element, often causing it's default click action.
 * @return {Element}         The clicked Element
 */
exports.clickElement = clickElement; function clickElement(element) {
	const evt = (this || global).window.document.createEvent('MouseEvents');
	evt.initEvent('click', true, true);
	element.dispatchEvent(evt);
	return element;
}

/**
 * Invokes a save dialog for a Blob or an Url object or strings target.
 * @param  {Blob|Url|string}  content  The Blob or url to save.
 * @param  {string}           name     The suggested file name.
 */
exports.saveAs = saveAs; function saveAs(content, name) {
	const window = (this || global).window;
	const isBlob = typeof content.type === 'string';

	const link = Object.assign(window.document.createElement('a'), {
		download: name,
		target: '_blank', // fallback
		href: isBlob ? window.URL.createObjectURL(content) : content,
	});
	clickElement.call(window, link);
	isBlob && global.setTimeout(() => window.URL.revokeObjectURL(link.href), 1000);
}

/**
 * Attempts to open a file picker dialog.
 * NOTE: currently only works in Chrome, not in Firefox (52)!
 * @param  {[type]}           options  An object whose properties are copied to the underlying input element.
 *                                     Useful properties are 'accept' and 'multiple'.
 * @return {Promise<[File]>}           A Promise to a (possibly empty) Array of Files.
 *                                     Should reject if the dialog fails to open.
 */
exports.loadFile = loadFile; function loadFile(options) { return new Promise(function(resolve, reject) {
	const window = (this || global).window, document = window.document; let done = false, open = false;

	const input = Object.assign(window.document.createElement('input'), {
		type: 'file',
	}, options);
	function onBlur() {
		open = true; // file picker has opened
	}
	const timer = global.setTimeout(() => {
		if (open || remove()) { return; }
		// file picker didn't open or change
		reject(new Error('Could not select file'));
	}, 100);
	function onFocus() { global.setTimeout(() => {
		if (remove()) { return; }
		resolve([ ]); // file picker was opened and closed, but no files were selected
	}, 100); }
	function onChange(event) { try {
		if (remove()) { return; }
		resolve(Array.from(input.files)); // actually got file(s)
	} catch (error) { reject(error); } }
	function remove() {
		if (done) { return true; } done = true;
		global.clearTimeout(timer);
		document.removeEventListener('change', onChange);
		window.removeEventListener('focus', onFocus);
		window.removeEventListener('blur', onBlur);
		input.remove();
		return false;
	}
	document.addEventListener('change', onChange);
	window.addEventListener('focus', onFocus);
	window.addEventListener('blur', onBlur);
	document.head.appendChild(input);
	clickElement.call(window, input);
}); }

/**
 * Loads the data referenced by a Blob (or File) object.
 * @param  {Blob}    blob  The Blob to read.
 * @param  {string}  type  Optional. The type/encoding of the returned data. May be 'string' (default, utf8),
 *                         'arrayBuffer', 'dataURL' or any string encoding accepted by <FileReader>.readAsText(..., type).
 * @return {Promise<String|ArrayBuffer}  Promise to the data read.
 */
exports.readBlob = readBlob; function readBlob(blob, type) {
	let reader;
	return new Promise(function(resolve, reject) {
		const window = (this || global).window;
		reader = new window.FileReader;
		reader.onerror = reject;
		reader.onloadend = () => {
			reader.onerror = reader.onloadend = null;
			resolve(reader.result);
		};

		if (type == null || type === 'string') {
			reader.readAsText(blob);
		} else if ((/^dataU[rR][iIlL]$/).test(type)) {
			reader.readAsDataURL(blob);
		} else if ((/^(?:arrayB|b)uffer$/).test(type)) {
			reader.readAsArrayBuffer(blob);
		} else {
			reader.readAsText(blob, type);
		}
	}).catch(error => {
		if (reader) { reader.onerror = reader.onloadend = null; }
		throw error;
	});
}

/**
 * Attempts to write data to the users clipboard.
 * @param  {string|object}  data  Ether a plain string or an object of multiple pairs { [mimeType]: data, } to write.
 * @param  {natural}        time  Maximum runtime of this asynchronous operation after which it will be canceled and rejected.
 * @return {Promise}              Promise that rejects if the timeout or an error occurred. If it resolves the operation should have succeeded.
 */
exports.writeToClipboard = writeToClipboard; function writeToClipboard(data, time) { return new Promise(function(resolve, reject) {
	const document = (this || global).window.document; let done = false;
	function onCopy(event) { try {
		if (done) { return; } done = true;
		document.removeEventListener('copy', onCopy);
		const transfer = event.clipboardData;
		transfer.clearData();
		if (typeof data === 'string') {
			transfer.setData('text/plain', data);
		} else {
			Object.keys(data).forEach(mimeType => transfer.setData(mimeType, data[mimeType]));
		}
		event.preventDefault();
		resolve();
	} catch (error) { reject(error); } }
	global.setTimeout(() => {
		if (done) { return; } done = true;
		document.removeEventListener('copy', onCopy);
		reject(new Error('Timeout after '+ (time || 1000) +'ms'));
	}, time || 1000);
	document.addEventListener('copy', onCopy);
	document.execCommand('copy', false, null);
}); }

/**
 * Listen for a DOM Event on an Element only once and removes the listener afterwards.
 */
exports.once = once; function once(element, event, callback, capture) {
	function handler() {
		element.removeEventListener(event, handler, capture);
		callback.apply(this, arguments);
	}
	element.addEventListener(event, handler, capture);
	return handler;
}

exports.whileVisible = whileVisible; function whileVisible(callback, time) {
	let handle; const document = (this || global).window.document;
	function check() {
		if (document.hidden) {
			return void (handle && global.clearInterval(handle));
		} else {
			!handle && (handle = global.setInterval(callback, time));
		}
	}
	check();
	document.addEventListener('visibilitychange', check);
	return function cancel() {
		document.addEventListener('visibilitychange', check);
		handle && global.clearTimeout(handle);
	};
}

/**
 * Get the closest parent element (or the element itself) that matches a selector.
 * @param  {Element}  element   The child element whose parent is searched for
 * @param  {string}   selector  The selector the parent has to match
 * @return {Element||null}      'element', if it matches 'selector' or the first parent of 'element' that matches 'selector', if any
 */
exports.getParent = getParent; function getParent(element, selector) {
	while (element && (!element.matches || !element.matches(selector))) { element = element.parentNode; }
	return element;
}

/**
 * Builds the strongest possible selector of tagNames, ids and classes for an Element (at its current position in the document).
 * @param  {Element}  element  The Element in question.
 * @return {string}            String that matches /^(?!>)((?:^|>){{tagName}}(#{{id}})?(.{{class}})*)*$/
 */
exports.getSelector = getSelector; function getSelector(element) {
	const document = (this || global).window.document, strings = [ ];
	while (element && element !== document) {
		strings.add(
			element.tagName
			+ (element.id ? '#'+ element.id : '')
			+ (element.className ? '.'+ element.className.replace(/ +/g, '.') : '')
		);
		element = element.parentNode;
	}
	return strings.join('>');
}

/* eslint-disable */ // the code below works, but is old and probably inefficient

exports.onElementChanged = onElementChanged; function onElementChanged(element, attributeFilter, callback) {
	return new (this || global).window.MutationObserver(function(mutations, observer) {
		mutations.forEach(function(mutation) {
			if (mutation.target.getAttribute(mutation.attributeName) !== mutation.oldValue) {
				try { callback(mutation.target, mutation.oldValue); } catch(e) {  }
			}
		});
		observer.takeRecords();
	}).observe(element, { subtree: false, attributes: true, attributeOldValue: true, attributeFilter: attributeFilter });
}

const Self = new WeakMap();
const CreationObserver = exports.CreationObserver = function CreationObserver(element) {
	const listeners = [/*{ callback: function(){}, selector: string [, single: true] }*/];
	const observer = new MutationObserver(function(mutations, observer) {
		mutations.forEach(function(mutation) {
			for (var j = 0, element; (element = mutation.addedNodes[j]); j++) {
				elementCreated(listeners, element);
				if (element.querySelectorAll) {
					for (var list = element.querySelectorAll("*"),
						i=0; (element = list[i]); i++) {
						elementCreated(listeners, element);
					}
				}
			}
		});
		observer.takeRecords();
	});
	observer.listeners = listeners;
	observer.element = element || global.document;
	Self.set(this, observer);
};
function elementCreated(listeners, element) {
	element.matches && listeners.forEach(function(listener, index) {
		if (element.matches(listener.selector)) {
			global.setTimeout(listener.callback, 0, element);
			if (listener.single) {
				delete listeners[index];
			}
		}
	});
}
CreationObserver.prototype.add = function(selector, callback, single) {
	const self = Self.get(this);
	if (self.listeners.find(function(item) { return item.selector == selector && item.callback == callback && !item.single === !single; })) { return; }
	self.listeners.push({ selector: selector, callback: callback, single: single });
	self.listeners.length == 1 && self.observe(self.element, { subtree: true, childList: true, });
};
CreationObserver.prototype.remove = function(selector, callback, single) {
	const self = Self.get(this);
	const length = self.listeners.length;
	self.listeners.filter(function(item) { return !item.selector == selector && item.callback == callback && !item.single == !single; });
	self.listeners.length === 0 && self.disconnect();
	return length - self.listeners.length;
};
CreationObserver.prototype.removeAll = function() {
	const self = Self.get(this);
	const length = self.listeners.length;
	self.listeners.length = 0;
	self.disconnect();
	return length;
};
CreationObserver.prototype.single = function(selector, callback) {
	const element = Self.get(this).element.querySelector(selector);
	if (element) {
		setTimeout(callback.bind(undefined, element), 0);
	} else {
		this.add(selector, callback, true);
	}
};
CreationObserver.prototype.all = function(selector, callback) {
	const alreadyExisting = Self.get(this).element.querySelectorAll(selector);
	this.add(selector, callback, false);

	for (var element, i = 0; (element = alreadyExisting[i]); i++) {
		global.setTimeout(callback.bind(undefined, element), 0);
	}
};

/* eslint-enable */

/**
 * Remove listener of a parent node. Observe the removal of any of it's child nodes.
 * @param {DomNode}  node  The parent node of the nodes to observe.
 */
const RemoveObserver = exports.RemoveObserver = function RemoveObserver(node) {
	let self = Self.get(node);
	if (!self) {
		self = new RemoveObserverPrivate(node);
		Self.set(node, self);
	}
	Self.set(this, self);
	return this;
};
/**
 * Invokes a callback once a child node or any of it's parents is removed from their parent.
 * Guaranteed to fire if a node that was part of the DOM gets removed from it in any way.
 * Listens to a single removal of node.
 * @param  {DomNode}   child     The element to observe.
 * @param  {function}  callback  The function to execute on the nodes removal.
 * @return {RemoveObserver?}     The RemoveObserver of child's parentNode, iff child has one.
 */
RemoveObserver.on = function(child, callback) {
	const parent = child.parentNode;
	if (!parent) { return null; }
	return RemoveObserver.prototype.on.call(RemoveObserver.call(parent, parent), child, callback);
};
/**
 * Removes a listener added by RemoveObserver.on().
 * @param  {DomNode}   child     The reference element.
 * @param  {function}  callback  The function that should not be executed on the nodes removal anymore.
 * @return {bool}                True iff a listener was actually removed.
 */
RemoveObserver.off = function(child, callback) {
	if (!child) { return false; }
	const parent = child.parentNode;
	if (!parent) { return false; }
	return RemoveObserver.prototype.off.call(RemoveObserver.call(parent, parent), child, callback);
};
Object.defineProperties(RemoveObserver.prototype, {
	// The DomNode this Observer observes.
	node: { get() { return Self.get(this).node; }, enumerable: true, },
	// The RemoveObserver of this node's parent
	parent: { get() { return Self.get(this).parent; }, enumerable: true, },
});
Object.assign(RemoveObserver.prototype, {
	/**
	 * Same as the static RemoveObserver.on, only that child must be a direct child of this.node.
	 * Faster when adding listeners for a lot of children of the same element.
	 */
	on(child, callback) {
		const self = Self.get(this);
		if (child.parentNode !== self.node) { throw new Error('The observed node must be a direct child of the node passed into the constructor'); }
		let _child = self.children.get(child);
		if (!_child) {
			if (!self.children.size) { self.attach(); }
			_child = new Set;
			self.children.set(child, _child);
		}
		_child.add(callback);
		return this;
	},
	/**
	 * Same as the static RemoveObserver.off, only that it can only remove listeners of direct children of this.node.
	 */
	off(child, callback) {
		const self = Self.get(this);
		const _child = self.children.get(child);
		if (!_child || !_child.delete(callback)) { return false; }
		if (_child.size) { return true; }
		self.children.delete(child);
		if (!self.children.size) { self.detach(); }
		return true;
	},
});
/// Private back end class for RemoveObserver. Can not be accessed. There will never be more than one instance per DomNode.
function RemoveObserverPrivate(node) {
	this.children = new Map;
	this.node = node;
	this.observer = null;
	this.parent = null;
	this.check = this.check.bind(this);
	this.removed = this.removed.bind(this);
}
Object.assign(RemoveObserverPrivate.prototype, {
	// called then a child was removed
	check(child) {
		const _child = this.children.get(child);
		if (!_child) { return; }
		_child.forEach(callback => { try {
			callback(child);
		} catch (error) { console.error(error); } });
		this.children.delete(child);
		if (!this.children.size) { this.detach(); }
	},
	// called when the node was removed from it's parent
	removed(_this_node) {
		this.children.forEach((_child, child) => {
			_child.forEach(callback => { try {
				callback(child);
			} catch (error) { console.error(error); } });
		});
		this.detach();
	},
	// listens for the removal of children and of the node from it's parent
	attach() {
		const check = this.check;
		this.observer = new (this.node.ownerDocument || this.node).defaultView
		.MutationObserver((mutations, observer) => {
			mutations.forEach(mutation => {
				const rn = mutation.removedNodes;
				for (let j = 0, length = rn.length; j < length; j++) { check(rn[j]); }
			});
			observer.takeRecords();
		});
		this.observer.observe(this.node, { childList: true, });
		if (!this.node.parentNode) { return; }
		this.parent = new RemoveObserver(this.node.parentNode);
		this.parent.on(this.node, this.removed);
	},
	// stops listening of removals and releases all resources
	detach() {
		if (!this.observer) { return; }
		this.children = new Map;
		this.observer.disconnect();
		this.observer = null;
		if (!this.parent) { return; }
		this.parent.off(this.node, this.removed);
		this.parent = null;
	},
});

exports.notify = notify; function notify(options) {
	const window = (this || global).window, Notification = window.Notification;
	return new Promise((resolve, reject) => {
		function doIt() {
			const self = new Notification(options.title, options);
			self.onclick = resolve;
			self.onerror = reject;
			self.onclose = reject;
			self.onshow = global.clearTimeout.bind(null, global.setTimeout(reject, options.timeout || 1500));
		}

		if (Notification.permission === 'granted') {
			doIt();
		} else if (Notification.permission !== 'denied') {
			Notification.requestPermission(permission => {
				if (permission === 'granted') {
					doIt();
				} else {
					reject(new Error('Permission denied'));
				}
			});
		} else  {
			reject(new Error('Permission denied'));
		}
	});
}

/**
 * Promise that resolves once the 'DOMContentLoaded' event is/was fired.
 */
exports.DOMContentLoaded = new Promise((resolve, reject) => {
	const document = global.document;
	if (typeof document !== 'object') { return void reject(new Error('No `document` global')); }
	if (document.readyState !== 'interactive' && document.readyState !== 'complete') {
		document.addEventListener('DOMContentLoaded', resolve);
	} else {
		resolve();
	}
});

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { global[factory.name] = result; } } })((function() { return this; })()); // eslint-disable-line

