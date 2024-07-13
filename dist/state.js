"use strict";
class State {
    constructor(name, currentValue, initialValue) {
        this.name = name;
        this.currentValue = currentValue;
        this.initialValue = initialValue;
        this.reset = () => {
            this.currentValue = this.initialValue;
        };
        if (!initialValue) {
            this.initialValue = currentValue;
        }
    }
    get current() {
        return this.currentValue;
    }
    get initial() {
        return this.initialValue;
    }
}
class VirtualElement {
    constructor(type, props, // Add type annotation for props
    children) {
        this.type = type;
        this.props = props;
        this.children = children;
        this.$host = null;
        this.props = props || { attributes: {} };
    }
    static fromElement(node) {
        const virtual = node instanceof Element
            ? new VirtualElement(node.nodeName, {
                attributes: Array.from(node.attributes).reduce((atts, att) => {
                    return { ...atts, [att.nodeName]: att.nodeValue };
                }, {}),
            }, Array.from(node.childNodes).map((child) => VirtualElement.fromElement(child)))
            : new VirtualElement(node.nodeName, { nodeValue: node.nodeValue });
        virtual.bindHost(node);
        return virtual;
    }
    bindHost(host) {
        this.$host = host;
        return this;
    }
    createElement() {
        let el = document.createElement("div");
        if (this.$host) {
            el = this.$host.cloneNode();
        }
        if (this.type === "#text") {
            el = document.createTextNode(this.props?.nodeValue);
        }
        else if (!this.$host && this.type !== "#text") {
            el = document.createElement(this.type);
        }
        if (this.props) {
            for (let prop in this.props) {
                Object.defineProperty(el, prop, {
                    value: this.props[prop],
                });
            }
        }
        if (this.children) {
            this.children.forEach((child) => {
                el.appendChild(child.createElement());
            });
        }
        this.bindHost(el);
        return el;
    }
    static CheckChanged(oldElement, newElement) {
        let changed = false;
        if (oldElement !== newElement) {
            changed = true;
        }
        else if (oldElement.props !== newElement.props) {
            changed = true;
        }
        else if (oldElement.children !== newElement.children) {
            changed = true;
        }
        return changed;
    }
    getAttribute(name) {
        if (!this.props)
            return;
        if (!this.props.attributes)
            return;
        return this.props?.attributes[name];
    }
    getAttributes() {
        return this.props?.attributes;
    }
    setAttributes(attributes) {
        if (!this.props)
            return;
        this.props.attributes = attributes;
        return this;
    }
    setAttribute(name, value) {
        if (!this.props)
            return;
        if (!this.props.attributes)
            this.props.attributes = {};
        this.props.attributes[name] = value;
        return this;
    }
    setPorp(name, value) {
        if (!this.props)
            this.props = {};
        this.props[name] = value;
        return this;
    }
    getPorp(name) {
        if (!this.props)
            return;
        return this.props[name];
    }
    transferValuesTo(virtual) {
        for (let prop in this) {
            virtual[prop] = this[prop];
        }
    }
    static Update(parent, newElement, oldElement) {
        if (!oldElement) {
            parent.appendChild(newElement.createElement());
        }
        else if (this.CheckChanged(oldElement, newElement) && oldElement.$host) {
            parent.replaceChild(newElement.createElement(), oldElement.$host);
        }
        else if (oldElement.$host) {
            parent.appendChild(newElement.createElement());
        }
        return newElement;
    }
}
class HTMLParser {
    constructor(config = {
        separator: "{}",
    }) {
        this.config = config;
        if (config.separator.length !== 2) {
            throw new Error("Separator must be 2 characters long");
        }
    }
    StringfyArray(arr, additional) {
        return arr.reduce((acc, curr) => {
            return acc + (typeof curr === "function" ? curr(additional) : curr) + " ";
        }, "");
    }
    ParseStringToFunction(html, parameterName) {
        const { separator } = this.config;
        const regExp = new RegExp(`${separator[0]}((?![\\s\\n]).)+${separator[1]}`, "g");
        const strings = html.split(" ");
        for (let index = 0; index < strings.length; index++) {
            if (regExp.test(strings[index])) {
                const fc = new Function(parameterName, " return " +
                    strings[index].replace(new RegExp(`[${separator}]`, "g"), ""));
                strings[index] = fc;
                continue;
            }
        }
        return strings;
    }
}
class StateManager {
    constructor(elcoverage, config = {
        parser: new HTMLParser({
            separator: "{}",
        }),
        keyword: "state",
    }) {
        this.elcoverage = elcoverage;
        this.config = config;
        this.loaded = false;
        this.attachedConsumers = [];
        this.attachedProducers = [];
        this.attachedListeners = [];
        this.states = new Map();
        this.init();
    }
    init() {
        this.attachedConsumers = this.getAllConsumer();
        this.attachedProducers = this.getAllProducer();
        this.initConsumer();
        this.initProducer();
        if (window["StateManager"])
            throw new Error("StateManager already initialized");
        window["StateManager"] = this;
        this.loaded = true;
    }
    static UpdateState(stateName, newState) {
        const stateManager = window["StateManager"];
        if (!stateManager) {
            throw new Error("StateManager not initialized");
        }
        if (stateName instanceof Element) {
            stateManager.setState(stateName.getAttribute("data-state-consumer") || "", newState);
            return;
        }
        stateManager.attachedConsumers
            .filter((consumer) => consumer.getAttribute("data-state-consumer") === stateName)
            .forEach(() => stateManager.setState(stateName, newState));
    }
    defineListeners(producer, states) {
        const eventListeners = new Map();
        function createCB(fc) {
            let cb;
            if (window[fc] &&
                typeof window[fc] === "function") {
                cb = window[fc];
            }
            else {
                cb = eval(fc);
            }
            try {
                if (!(typeof cb === "function")) {
                    throw new Error("Callback is not a function");
                }
            }
            catch (e) {
                throw new Error(e);
            }
            return function modifiedEventCallback(e, states) {
                return cb(e, states);
            };
        }
        function ModifyListeners(producer) {
            const regExp = /^on([a-zA-Z0-9_]+)/;
            const matches = Object.keys(producer.getAttributes()).filter((key) => regExp.test(key));
            for (let match of matches) {
                const eventKey = match.match(regExp)[1];
                if (producer.getAttribute(match) &&
                    (typeof producer.getAttribute(match) === "function" ||
                        typeof producer.getAttribute(match) === "string")) {
                    const fc = createCB(producer.getAttribute(match));
                    producer.$host.addEventListener(eventKey, (e) => {
                        fc(e, states);
                    });
                    Object.defineProperty(producer.$host, eventKey, {
                        value: null,
                    });
                    eventListeners.set(eventKey, [fc]);
                }
            }
        }
        ModifyListeners(producer);
        return eventListeners;
    }
    attachProducerListeners(producer) {
        const eventListeners = this.defineListeners(producer, this.states);
        producer.setPorp("eventListeners", eventListeners);
        this.attachedListeners.push({
            virtualDom: producer,
            listeners: eventListeners,
        });
    }
    initProducer() {
        const producers = this.getAllProducer();
        producers.forEach((producer) => {
            if (producer.$host) {
                this.attachProducerListeners(producer);
            }
        });
    }
    parseInitialValue(value) {
        try {
            return JSON.parse(value);
        }
        catch (e) {
            throw new Error("Invalid JSON format for initial value : " + e);
        }
    }
    initConsumer() {
        const consumers = this.attachedConsumers;
        consumers.forEach((consumer) => {
            const stateName = consumer.getAttribute("data-state-consumer") || "empty";
            const stateInitialValue = this.parseInitialValue(consumer.getAttribute("data-state-initialvalue") || "null");
            if (!this.states.get(stateName)) {
                const state = new State(stateName, stateInitialValue);
                this.states.set(stateName, state);
                this.setState(stateName, stateInitialValue);
            }
            else {
                this.setState(stateName);
            }
        });
    }
    setState(stateName, newStateValue) {
        const state = this.states.get(stateName);
        if (!state) {
            return console.warn(`State ${stateName} not found`);
        }
        const newState = new State(stateName, newStateValue, state.initial);
        Object.freeze(newState);
        this.states.delete(stateName);
        this.states.set(stateName, newState);
        this.updateConsumer(stateName, newState);
    }
    updateConsumer(stateName, state) {
        if (!state) {
            return console.warn(`State ${stateName} not found`);
        }
        this.attachedConsumers.forEach((consumer) => {
            if (consumer.getAttribute("data-state-consumer") === stateName) {
                this.renderConsumer(consumer, state);
            }
        });
    }
    renderConsumer(consumer, state) {
        const { attributeFunctionCallbacks, textNodesFunctionCallbacks } = consumer.getPorp("templates") ||
            this.extractTemplateFormConsumer(consumer);
        consumer.setPorp("templates", {
            attributeFunctionCallbacks,
            textNodesFunctionCallbacks,
        });
        const newVirtual = new VirtualElement(consumer.type, consumer.props, consumer.children);
        newVirtual.bindHost(consumer.$host);
        if (consumer.$host instanceof HTMLElement) {
            attributeFunctionCallbacks.forEach((listener) => {
                const [key] = Object.keys(listener);
                const value = listener[key];
                if (value.startsWith("state")) {
                    newVirtual.setAttribute(key, state.current);
                }
                if (value.includes("state.")) {
                    const stateValue = state.current[value.split("state.")[1]];
                    newVirtual.setAttribute(key, stateValue);
                }
            });
        }
        else if (consumer.$host instanceof Text) {
            newVirtual.setPorp("nodeValue", this.config.parser.StringfyArray(textNodesFunctionCallbacks, this.states));
        }
        VirtualElement.Update(consumer.$host.parentElement, newVirtual, consumer).transferValuesTo(consumer);
        if (this.config &&
            this.config.templateEngineProcessor &&
            consumer instanceof this.config.templateEngineProcessor.CustomElementClass) {
            this.config.templateEngineProcessor.proccess(consumer, state, this.renderConsumer.bind(this));
        }
        if (consumer.children) {
            consumer.children.forEach((child) => {
                this.renderConsumer(child, state);
            });
        }
    }
    getAllProducer() {
        const producers = this.elcoverage.querySelectorAll("[data-state-producer]");
        return Array.from(producers)
            .filter((producer) => producer.nodeType !== 3)
            .map((producer) => {
            const virtual = new VirtualElement(producer.tagName, {
                attributes: Object.assign({}, Array.from(producer.attributes).reduce((atts, att) => {
                    return { ...atts, [att.nodeName]: att.nodeValue };
                }, {})),
            });
            virtual.bindHost(producer);
            return virtual;
        });
    }
    extractTemplateFormConsumer(consumer) {
        const attributeFunctionCallbacks = new Set();
        let textNodesFunctionCallbacks = new Array();
        function getAttributeListener(el) {
            for (let att, i = 0, atts = el.$host.attributes, n = atts.length; i < n; i++) {
                att = atts[i];
                if (att.nodeName === "data-state-consumer") {
                    continue;
                }
                if (att.nodeValue && att.nodeValue.startsWith("state")) {
                    attributeFunctionCallbacks.add({
                        [att.nodeName]: att.nodeValue,
                    });
                }
            }
        }
        function getTextNodeListener(el, proccesor, keyword) {
            return proccesor(el.getPorp("nodeValue"), keyword);
        }
        if (consumer.$host instanceof Element)
            getAttributeListener(consumer);
        else
            textNodesFunctionCallbacks = getTextNodeListener(consumer, this.config.parser.ParseStringToFunction.bind(this.config.parser), this.config.keyword || "state");
        return { attributeFunctionCallbacks, textNodesFunctionCallbacks };
    }
    getAllConsumer() {
        const consumers = this.elcoverage.querySelectorAll("[data-state-consumer]");
        return Array.from(consumers).map((consumer) => VirtualElement.fromElement(consumer));
    }
}
