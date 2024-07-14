import VirtualElement from "./chore/virtualDOM";
import State from "./chore/state";
import HTMLParser from "./chore/HTMLparser";

type ConfiGStateManagerType = {
  templateEngineProcessor?: any;
  parser: HTMLParser;
  keyword?: string;
  slices?: StateManagerSlice[];
};

type StateManagerSlice = {
  name: string;
  reducers: {
    [key: string]: ReducerFC;
  };
  actions: {
    [x: string]: ActionFC;
  };
  state: State;
};

type ActionPayload = {
  type?: string;
  payload?: any;
};

type ActionPayloadDefindedType = {
  payload: any;
};

type StateValue = {
  value: any;
};

type ReducerFC = (state: StateValue, action: ActionPayload) => void;
type ActionFC = (action: ActionPayloadDefindedType) => ActionPayload;
type CreateSliceConfig = {
  name: string;
  initialState: {
    value: any;
  };
  reducers: {
    [key: string]: ReducerFC;
  };
};

type ReadOnlyStates = {
  [key: string]: {
    value: any;
    initial: any;
  };
};

export class StateManager {
  public loaded = false;
  public attachedConsumers: VirtualElement[] = [];
  public attachedProducers: VirtualElement[] = [];
  public attacedSlices: Map<string, StateManagerSlice> = new Map();
  public attachedListeners: {
    virtualDom: VirtualElement;
    listeners: Map<string, Function[]>;
  }[] = [];
  private states: Map<string, State> = new Map();

  constructor(
    public elcoverage: HTMLElement,
    public config: ConfiGStateManagerType = {
      parser: new HTMLParser({
        separator: "{}",
      }),
      keyword: "state",
    }
  ) {
    this.init();
  }

  init() {
    this.attachedConsumers = this.getAllConsumer();
    this.attachedProducers = this.getAllProducer();

    this.initConsumer();
    this.initProducer();

    this.init_slices(this.config.slices || []);

    if ((window as any)["StateManager" as keyof Window])
      throw new Error("StateManager already initialized");
    (window as any)["StateManager" as keyof Window] = this;
    this.loaded = true;
  }

  init_slices(slices: StateManagerSlice[]) {
    this.attacedSlices = new Map(slices.map((slice) => [slice.name, slice]));
    slices.forEach((slice) => {
      this.states.set(slice.name, slice.state);
      this.setState(slice.name, this.states.get(slice.name)?.value);
    });
  }

  get state(): ReadOnlyStates {
    return Array.from(this.states.values()).reduce((acc, curr) => {
      return {
        ...acc,
        [curr.name]: {
          value: curr.value,
          initial: curr.initial,
        },
      };
    }, {});
  }

  static Dispatch(action: ActionPayload) {
    const stateManager = window["StateManager" as keyof Window] as StateManager;

    if (!stateManager) {
      throw new Error("StateManager not initialized");
    }

    const [sliceName, reducerName] = action.type!.split("/");

    const slice = stateManager.attacedSlices.get(sliceName);

    if (!slice) {
      throw new Error("Slice not found");
    }

    const reducer = slice.reducers[reducerName];

    if (!reducer) {
      throw new Error("Reducer not found");
    }

    const newState = new State(
      sliceName,
      stateManager.states.get(sliceName)?.value
    );

    if (!newState) {
      throw new Error("State not found");
    }

    reducer(newState, action);

    stateManager.setState(sliceName, newState.value);
  }

  static CreateSlice(config: CreateSliceConfig): StateManagerSlice {
    const reducers: { [key: string]: ActionFC } = {};

    for (let key in config.reducers) {
      reducers[key] = function (action: ActionPayload) {
        return {
          type: "name/" + key,
          payload: action,
        };
      };
    }

    const slice = {
      name: config.name,
      reducers: config.reducers,
      actions: {
        ...reducers,
      },
      state: new State(config.name, config.initialState),
    };

    return slice;
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
    const { attributeFunctionCallbacks, textNodesFunctionCallbacks } =
      consumer.getPorp("templates") ||
      this.extractTemplateFormConsumer(consumer);

    consumer.setPorp("templates", {
      attributeFunctionCallbacks,
      textNodesFunctionCallbacks,
    });

    const newVirtual = new VirtualElement(
      consumer.type,
      consumer.props,
      consumer.children
    );

    newVirtual.bindHost(consumer.$host);

    if (consumer.$host instanceof HTMLElement) {
      attributeFunctionCallbacks.forEach(
        (listener: { [key: string]: string }) => {
          const [key] = Object.keys(listener);
          const value = listener[key];

          if (value.startsWith("state")) {
            newVirtual.setAttribute(key, state.value);
          }

          if (value.includes("state.")) {
            const stateValue = state.value[value.split("state.")[1]];
            newVirtual.setAttribute(key, stateValue);
          }
        }
      );
    } else if (consumer.$host instanceof Text) {
      newVirtual.setPorp(
        "nodeValue",
        this.config.parser.StringfyArray(textNodesFunctionCallbacks, this.state)
      );
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

  private extractTemplateFormConsumer(consumer: VirtualElement): {
    attributeFunctionCallbacks: Set<{ [key: string]: string }>;
    textNodesFunctionCallbacks: Function[];
  } {
    const attributeFunctionCallbacks: Set<{ [key: string]: string }> =
      new Set();
    let textNodesFunctionCallbacks = new Array();

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
          attributeFunctionCallbacks.add({
            [att.nodeName]: att.nodeValue,
          });
        }
      }
    }

    function getTextNodeListener(
      el: VirtualElement,
      proccesor: (text: string, keyword: string) => (Function | string)[],
      keyword: string
    ) {
      return proccesor(el.getPorp("nodeValue") as string, keyword);
    }

    if (consumer.$host instanceof Element) getAttributeListener(consumer);
    else
      textNodesFunctionCallbacks = getTextNodeListener(
        consumer,
        this.config.parser.ParseStringToFunction.bind(this.config.parser),
        this.config.keyword || "state"
      );

    return { attributeFunctionCallbacks, textNodesFunctionCallbacks };
  }

  getAllConsumer(): VirtualElement[] {
    const consumers = this.elcoverage.querySelectorAll("[data-state-consumer]");
    return Array.from(consumers).map((consumer) =>
      VirtualElement.fromElement(consumer as Element, {
        excludedAttributes: ["data-state-initialvalue"],
      })
    );
  }
}
