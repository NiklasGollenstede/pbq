(function(exports) { 'use strict';

/* global setTimeout */ /* global clearTimeout */
const timeout = (typeof setTimeout !== 'undefined') ? setTimeout : require("sdk/timers").setTimeout;
const unTimeout = (typeof clearTimeout !== 'undefined') ? clearTimeout : require("sdk/timers").clearTimeout;
/* global setTimeout */ /* global clearTimeout */
const interval = (typeof setInterval !== 'undefined') ? setInterval : require("sdk/timers").setInterval;
const unInterval = (typeof clearInterval !== 'undefined') ? clearInterval : require("sdk/timers").clearInterval;

const copyProperties = require('es6lib/object').copyProperties;

/**
 * The functions in this module operate on the global windows 'document' (and URL, self, top, etc.) by default.
 * This is the default document.
 * To have any of the functions of this module operate on a different scope, call them with that scope as this,
 * e.g. `cerateElement.call(iframe.contentWindow, 'a', { ...});` to create an Element in an iframe.
 */
exports.defaultWindow = typeof window !== 'undefined' ? window : null;

/**
 * Returns true, if the current execution context is not a browser top level context.
 * I.e the current script is executed in an iframe.
 */
const inIframe = exports.inIframe = function inIframe() {
	try { return ((this || window).self !== (this || window).top); } catch (e) { return true; }
};

/**
 * Creates a dom element and sets properties/attributes and children.
 * @param  {string}          tagName     Type of the new Element.
 * @param  {object}          properties  Optional object of properties, whisch are deeply copied onto the new element.
 * @param  {Array(Element)}  childList   Optional Array of elements set as the children of the new elenent.
 * @return {Element}                     New DOM element
 */
const createElement = exports.createElement = function createElement(tagName, properties, childList) {
	const element = (this || window).document.createElement(tagName);
	if (Array.isArray(properties)) { childList = properties; properties = null; }
	properties && copyProperties(element, properties);
	for (var i = 0; childList && i < childList.length; ++i) {
		childList[i] && element.appendChild(childList[i]);
	}
	return element;
};

/**
 * Creates a new style Element of the given css string.
 */
const createStyleElement = exports.createStyleElement = function createStyleElement(css) {
	const element = (this || window).document.createElement("style");
	element.type = "text/css";
	element.textContent = css;
	return element;
};

/**
 * Adds a css string to the document.
 * @param {string}  css  Style to add to the end of the document head.
 * @return {Element}     The new style Element.
 */
const addStyle = exports.addStyle = function addStyle(css) {
	return (this || window).document.querySelector("head").appendChild(createStyleElement(css));
};

/**
 * Triggers a 'click' event on a DOM Element, often causing it's default click action.
 * @return {Element}         The clicked Element
 */
const clickElement = exports.clickElement = function clickElement(element) {
	const evt = (this || window).document.createEvent('MouseEvents');
	evt.initEvent('click', true, true);
	element.dispatchEvent(evt);
	return element;
};

/**
 * Invokes a save dialogue for a Blob or Url object.
 * @param  {Blob|Url}  content The Blob or Url to save.
 * @param  {string}    name    The suggested file name.
 * @return {void}
 */
const saveAs = exports.saveAs = function saveAs(content, name) {
	const win = this || window;
	const isBlob = typeof content.type === 'string';

	const link = Object.assign(win.document.createElement('a'), {
		download: name,
		target: '_blank', // fallback
		href: isBlob ? win.URL.createObjectURL(content) : content,
	});

	clickElement.call(win, link);

	isBlob && timeout(function() { win.URL.revokeObjectURL(link.href); }, 1000);
};

/**
 * Listen for a DOM Event on an Element only once and removes the listener afterwards.
 */
const once = exports.once = function once(element, event, callback, capture) {
	function handler() {
		element.removeEventListener(event, handler, capture);
		callback.apply(this, arguments);
	}
	element.addEventListener(event, handler, capture);
	return handler;
};

const whileVisible = exports.whileVisible = function whileVisible(callback, time) {
	var handle;
	function check() {
		if ((this || window).document.hidden) {
			return handle && unInterval(handle);
		} else {
			!handle && (handle = intreval(callback, time));
		}
	}
	check();
	(this || window).document.addEventListener('visibilitychange', check);
	return function cancel() {
		(this || window).document.addEventListener('visibilitychange', check);
		handle && unTimeout(handle);
	};
};

/**
 * Builds the strongest possible selector of tagNames, ids and classes for an Element (at its's current position in the document).
 * @param  {Element}  element  The Element in question.
 * @return {string}            String that matches /^({{tagName}}(#{{id}})?(.{{class}})*)*$/
 */
const getSelector = exports.getSelector = function getSelector(element) {
	const document = (this || window).document, strings = [ ];
	while (element && element !== document) {
		strings.add(
			element.tagName
			+ (element.id ? '#'+ element.id : '')
			+ (element.className ? '.'+ element.className.replace(/ +/g, '.') : '')
		);
		element = element.parentNode;
	}
	return strings.join('>');
};

const onElementChanged = exports.onElementChanged = function onElementChanged(element, attributeFilter, callback) {
	return new (this || window).MutationObserver(function(mutations, observer) {
		mutations.forEach(function(mutation) {
			if (mutation.target.getAttribute(mutation.attributeName) != mutation.oldValue) {
				try { callback(mutation.target, mutation.oldValue); } catch(e) {  }
			}
		});
		observer.takeRecords();
	}).observe(element, { subtree: false, attributes: true, attributeOldValue: true, attributeFilter: attributeFilter });
};

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
	observer.element = element || document;
	Self.set(this, observer);
};
function elementCreated(listeners, element) {
	element.matches && listeners.forEach(function(listener, index) {
		if (element.matches(listener.selector)) {
			timeout(listener.callback, 0, element);
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
	self.listeners.length == 1 && self.observe(self.element, { subtree: true, childList: true });
};
CreationObserver.prototype.remove = function(selector, callback, single) {
	const self = Self.get(this);
	const length = self.listeners.length;
	self.listeners.filter(function(item) { return !item.selector == selector && item.callback == callback && !item.single == !single; });
	self.listeners.length === 0 && self.disconnect();
	return length - self.listeners.length;
};
CreationObserver.prototype.single = function(selector, callback) {
	const element = Self.get(this).element.querySelector(selector);
	if (element) {
		timeout(callback.bind(undefined, element), 0);
	} else {
		this.add(selector, callback, true);
	}
};
CreationObserver.prototype.all = function(selector, callback) {
	const alreadyExisting = Self.get(this).element.querySelectorAll(selector);
	this.add(selector, callback, false);

	for (var element, i = 0; (element = alreadyExisting[i]); i++) {
		timeout(callback.bind(undefined, element), 0);
	}
};

const notify = exports.notify = function notify(options) {
	return new Promise(function(resolve, reject) {
		function doIt() {
			const self = new Notification(options.title, options);
			self.onclick = resolve;
			self.onerror = reject;
			self.onclose = reject;
			self.onshow = unTimeout.bind(null, timeout(reject, options.timeout || 1500));
		}

		if (Notification.permission === "granted") {
			doIt();
		} else if (Notification.permission !== 'denied') {
			Notification.requestPermission(function(permission) {
				if (permission === "granted") {
					doIt();
				} else {
					reject("permission denied");
				}
			});
		} else  {
			reject("permission denied");
		}
	});
};

/**
 * Promise that resolves once the 'DOMContentLoaded' event is/was fired.
 */
const DOMContentLoaded = exports.DOMContentLoaded = new Promise(function(resolve, reject) {
	if (typeof document !== 'object') { return reject(); }
	if (document.readyState !== 'interactive' && document.readyState !== 'complete') {
		document.addEventListener('DOMContentLoaded', resolve);
	} else {
		resolve();
	}
});

const moduleName = 'es6lib/dom'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
