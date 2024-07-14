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

  static fromElement(
    node: Node | Element,
    config?: {
      excludedAttributes?: string[];
    }
  ): VirtualElement {
    const virtual =
      node instanceof Element
        ? new VirtualElement(
            node.nodeName,
            {
              attributes: Array.from(node.attributes).reduce((atts, att) => {
                if (config?.excludedAttributes?.includes(att.nodeName)) {
                  return atts;
                }
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

  public getHost() {
    return this.$host;
  }

  private createElement() {
    let el: HTMLElement | Text = document.createElement("div");

    if (this.type === "#text") {
      el = document.createTextNode(this.props?.nodeValue);
    } else if (this.type !== "#text") {
      el = document.createElement(this.type);
    }

    if (this.props) {
      for (let prop in this.props) {
        Object.defineProperty(el, prop, {
          value: this.props[prop],
        });
      }

      if (this.props.attributes && el instanceof HTMLElement) {
        for (let att in this.props.attributes) {
          if(att in this.props) continue;
          el.setAttribute(att, this.props.attributes[att]);
        }
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

export default VirtualElement;