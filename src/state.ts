class State {
  constructor(
    public name: string,
    private currentValue: any,
    private initialValue?: any
  ) {
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

  reset = () => {
    this.currentValue = this.initialValue;
  };
}

interface Props {
  template?: string;
  [key: string]: any;
}

class VirtualElement {
  $host: Element | Node | null;
  constructor(
    public type: string,
    public props?: Props, // Add type annotation for props
    public children?: VirtualElement[]
  ) {
    this.$host = null;
    this.props = props || { attributes: {} };
  }

  static fromElement(node: Node | Element): VirtualElement {
    const virtual =
      node instanceof Element
        ? new VirtualElement(
            node.nodeName,
            {
              attributes: Array.from(node.attributes).reduce((atts, att) => {
                return { ...atts, [att.nodeName]: att.nodeValue };
              }, {}),
            },
            Array.from(node.childNodes).map((child) =>
              VirtualElement.fromElement(child as Node)
            )
          )
        : new VirtualElement(node.nodeName, { nodeValue: node.nodeValue });

    virtual.bindHost(node as HTMLElement);

    return virtual;
  }

  bindHost(host: Element | Node | null) {
    this.$host = host;
    return this;
  }

  private createElement() {
    let el: HTMLElement | Text = document.createElement("div");

    if (this.$host) {
      el = this.$host.cloneNode() as HTMLElement;
    }

    if (this.type === "#text") {
      el = document.createTextNode(this.props?.nodeValue);
    } else if (!this.$host && this.type !== "#text") {
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

  static CheckChanged(oldElement: VirtualElement, newElement: VirtualElement) {
    let changed = false;

    if (oldElement !== newElement) {
      changed = true;
    } else if (oldElement.props !== newElement.props) {
      changed = true;
    } else if (oldElement.children !== newElement.children) {
      changed = true;
    }

    return changed;
  }

  public getAttribute(name: string) {
    if (!this.props) return;
    if (!this.props.attributes) return;
    return this.props?.attributes[name];
  }

  public getAttributes() {
    return this.props?.attributes;
  }

  setAttributes(attributes: { [key: string]: any }) {
    if (!this.props) return;
    this.props.attributes = attributes;
    return this;
  }

  setAttribute(name: string, value: any) {
    if (!this.props) return;
    if (!this.props.attributes) this.props.attributes = {};
    this.props.attributes[name] = value;
    return this;
  }

  setPorp(name: string, value: any) {
    if (!this.props) this.props = {};
    this.props[name] = value;
    return this;
  }

  getPorp(name: string) {
    if (!this.props) return;
    return this.props[name];
  }

  transferValuesTo(virtual: VirtualElement) {
    for (let prop in this) {
      virtual[prop as keyof VirtualElement] = this[
        prop as keyof VirtualElement
      ] as any;
    }
  }

  static Update(
    parent: HTMLElement,
    newElement: VirtualElement,
    oldElement?: VirtualElement
  ) {
    if (!oldElement) {
      parent.appendChild(newElement.createElement());
    } else if (this.CheckChanged(oldElement, newElement) && oldElement.$host) {
      parent.replaceChild(newElement.createElement(), oldElement.$host);
    } else if (oldElement.$host) {
      parent.appendChild(newElement.createElement());
    }

    return newElement;
  }
}

type ConfiGStateManagerType = {
  templateEngineProcessor?: any;
};

class StateManager {
  public loaded = false;
  public attachedConsumers: VirtualElement[] = [];
  public attachedProducers: VirtualElement[] = [];
  public attachedListeners: {
    virtualDom: VirtualElement;
    listeners: Map<string, Function[]>;
  }[] = [];
  public states: Map<string, State> = new Map();

  constructor(
    public elcoverage: HTMLElement,
    public config?: ConfiGStateManagerType
  ) {
    this.init();
  }

  init() {
    this.attachedConsumers = this.getAllConsumer();
    this.attachedProducers = this.getAllProducer();

    this.initConsumer();
    this.initProducer();

    if ((window as any)["StateManager" as keyof Window])
      throw new Error("StateManager already initialized");
    (window as any)["StateManager" as keyof Window] = this;
    this.loaded = true;
  }

  static UpdateState(stateName: string | Element, newState: any) {
    const stateManager = window["StateManager" as keyof Window] as StateManager;

    if (!stateManager) {
      throw new Error("StateManager not initialized");
    }

    if (stateName instanceof Element) {
      stateManager.setState(
        stateName.getAttribute("data-state-consumer") || "",
        newState
      );
      return;
    }

    stateManager.attachedConsumers
      .filter(
        (consumer) => consumer.getAttribute("data-state-consumer") === stateName
      )
      .forEach(() => stateManager.setState(stateName, newState));
  }

  defineListeners(
    producer: VirtualElement,
    states: Map<string, State>
  ): Map<string, Function[]> {
    const eventListeners: Map<string, Function[]> = new Map();

    function createCB(fc: Function | string) {
      let cb: Function;

      if (
        window[fc as keyof Window] &&
        typeof window[fc as keyof Window] === "function"
      ) {
        cb = window[fc as keyof Window];
      } else {
        cb = eval(fc as string);
      }

      try {
        if (!(typeof cb === "function")) {
          throw new Error("Callback is not a function");
        }
      } catch (e) {
        throw new Error(e as string);
      }

      return function modifiedEventCallback(
        e: Event,
        states: Map<string, State>
      ): void {
        return cb(e, states);
      };
    }

    function ModifyListeners(producer: VirtualElement) {
      const regExp = /^on([a-zA-Z0-9_]+)/;

      const matches = Object.keys(producer.getAttributes()).filter((key) =>
        regExp.test(key)
      );

      for (let match of matches) {
        const eventKey = match.match(regExp)![1];

        if (
          producer.getAttribute(match) &&
          (typeof producer.getAttribute(match) === "function" ||
            typeof producer.getAttribute(match) === "string")
        ) {
          const fc = createCB(producer.getAttribute(match));

          producer.$host!.addEventListener(eventKey, (e: Event) => {
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

  attachProducerListeners(producer: VirtualElement) {
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

  private parseInitialValue(value: string) {
    try {
      return JSON.parse(value);
    } catch (e) {
      throw new Error("Invalid JSON format for initial value : " + e);
    }
  }

  private initConsumer() {
    const consumers = this.attachedConsumers;

    consumers.forEach((consumer) => {
      const stateName = consumer.getAttribute("data-state-consumer") || "empty";

      const stateInitialValue = this.parseInitialValue(
        consumer.getAttribute("data-state-initialvalue") || "null"
      );

      if (!this.states.get(stateName)) {
        const state = new State(stateName, stateInitialValue);
        this.states.set(stateName, state);
        this.setState(stateName, stateInitialValue);
      } else {
        this.setState(stateName);
      }
    });
  }

  setState(stateName: string, newStateValue?: any) {
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

  updateConsumer(stateName: string, state: State) {
    if (!state) {
      return console.warn(`State ${stateName} not found`);
    }
    this.attachedConsumers.forEach((consumer) => {
      if (consumer.getAttribute("data-state-consumer") === stateName) {
        this.renderConsumer(consumer, state);
      }
    });
  }

  renderConsumer(consumer: VirtualElement, state: State) {
    const { attributeListeners, textNodesListeners } =
      consumer.getPorp("templates") ||
      this.extractTemplateFormConsumer(consumer);

    consumer.setPorp("templates", { attributeListeners, textNodesListeners });

    const newVirtual = new VirtualElement(
      consumer.type,
      consumer.props,
      consumer.children
    );

    newVirtual.bindHost(consumer.$host);

    if (consumer.$host instanceof HTMLElement) {
      attributeListeners.forEach((listener: { [key: string]: string }) => {
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
    } else if (consumer.$host instanceof Text) {
      textNodesListeners.forEach((key: string) => {
        if (key.includes("state.")) {
          const stateValue = state.current[key.split("state.")[1]];
          newVirtual.setPorp(
            "nodeValue",
            (key as string).replace(/{state(\.[a-zA-Z0-9_]+)?}/g, stateValue)
          );
        }

        if (key.includes("state")) {
          newVirtual.setPorp(
            "nodeValue",
            (key as string).replace(/{state(\.[a-zA-Z0-9_]+)?}/g, state.current)
          );
        }
      });
    }

    VirtualElement.Update(
      consumer.$host!.parentElement!,
      newVirtual,
      consumer
    ).transferValuesTo(consumer);

    if (
      this.config &&
      this.config.templateEngineProcessor &&
      consumer instanceof this.config.templateEngineProcessor.CustomElementClass
    ) {
      this.config.templateEngineProcessor.proccess(
        consumer,
        state,
        this.renderConsumer.bind(this)
      );
    }

    if (consumer.children) {
      consumer.children.forEach((child) => {
        this.renderConsumer(child, state);
      });
    }
  }

  getAllProducer(): VirtualElement[] {
    const producers = this.elcoverage.querySelectorAll("[data-state-producer]");
    return Array.from(producers)
      .filter((producer) => producer.nodeType !== 3)
      .map((producer) => {
        const virtual = new VirtualElement(producer.tagName, {
          attributes: Object.assign(
            {},
            Array.from(producer.attributes).reduce((atts, att) => {
              return { ...atts, [att.nodeName]: att.nodeValue };
            }, {})
          ),
        });
        virtual.bindHost(producer as HTMLElement);

        return virtual;
      });
  }

  private extractTemplateFormConsumer(consumer: VirtualElement) {
    const attributeListeners: Set<{ [key: string]: string }> = new Set();
    const textNodesListeners: Set<string> = new Set();

    function getAttributeListener(el: VirtualElement) {
      for (
        let att,
          i = 0,
          atts = (el.$host! as HTMLElement).attributes,
          n = atts.length;
        i < n;
        i++
      ) {
        att = atts[i];

        if (att.nodeName === "data-state-consumer") {
          continue;
        }

        if (att.nodeValue && att.nodeValue.startsWith("state")) {
          attributeListeners.add({
            [att.nodeName]: att.nodeValue,
          });
        }
      }
    }

    function getTextNodeListener(el: VirtualElement) {
      const matchesValueConsumers = el
        .getPorp("nodeValue")
        .match(/({state(\.[a-zA-Z0-9_]+)?})/g);

      if (matchesValueConsumers) {
        for (let match of matchesValueConsumers) {
          textNodesListeners.add(el.$host?.nodeValue ?? "");
        }
      }
    }

    if (consumer.$host instanceof Element) getAttributeListener(consumer);
    else getTextNodeListener(consumer);

    return { attributeListeners, textNodesListeners };
  }

  getAllConsumer(): VirtualElement[] {
    const consumers = this.elcoverage.querySelectorAll("[data-state-consumer]");
    return Array.from(consumers).map((consumer) =>
      VirtualElement.fromElement(consumer as Element)
    );
  }
}
