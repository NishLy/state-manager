// export class StateManagerElementsProccessor {
//     public CustomElementClass: any;
//     constructor() {
//       class StateElement extends HTMLElement {
//         constructor() {
//           super();
//           this.virtualChild = null;
//         }
//       }

//       this.CustomElementClass = StateElement;
//       if (window.customElements.get("state-consumer")) return;
//       window.customElements.define("state-consumer", StateElement);
//     }
  
//     validateConsumerChildren(el) {
//       if (el.children.length !== 1 && !el.virtualChild)
//         throw new Error(
//           "State consumer element must have only one child element"
//         );
  
//       if (!(el instanceof this.StateElement)) return false;
  
//       return true;
//     }
  
//     proccess(el, state, renderer) {
//       if (!this.validateConsumerChildren(el)) return;
  
//       if (el.getAttribute("data-state-type") === "array") {
//         this.handleARRAY(el, state, renderer);
//       }
  
//       if (el.getAttribute("data-state-type") === "if") {
//         this.handleIF(el, state, renderer);
//       }
  
//       if (el.getAttribute("data-state-type") === "else") {
//         this.handleELSE(el, state, renderer);
//       }
//     }
  
//     handleARRAY(consumer, state) {
//       if (consumer.getAttribute("data-state-type") === "array") {
//         if (consumer.children.length < 1 && consumer.children.length > 1) {
//           throw new Error(
//             "State consumer element must have only one child element"
//           );
//         }
  
//         try {
//           let array = state.state;
  
//           if (!(array instanceof Object)) {
//             array = JSON.parse(state.state);
//             if (!Array.isArray(array)) {
//               throw new Error(
//                 "State consumer type array must be have value of array"
//               );
//             }
//           }
  
//           state.state = array;
  
//           if (!consumer.defaultTemplate) {
//             if (consumer.children.length < 1) {
//               throw new Error(
//                 "State consumer element must have only one child element"
//               );
//             }
//             consumer.defaultTemplate = consumer.children[0].cloneNode(true);
//             consumer.children[0].remove();
//           }
  
//           consumer.innerHTML = "";
//           for (let i = 0; i < array.length; i++) {
//             const el = consumer.defaultTemplate.cloneNode(true);
  
//             this.renderConsumer(el, new State("state", array[i]));
  
//             consumer.appendChild(el);
//           }
//         } catch (e) {
//           throw new Error(e);
//         }
//       }
//     }
  
//     handleIF(el, state, renderer) {
//       try {
//         if (typeof state.state === "string")
//           state.state = JSON.parse(state.state);
//       } catch (e) {
//         throw new Error(e);
//       }
  
//       if (!el.virtualChild) {
//         el.virtualChild = Array.from(el.children);
//       }
  
//       el.innerHTML = "";
  
//       if (!!state.state) {
//         el.innerHTML = "";
//         Array.from(el.virtualChild).forEach((child) => {
//           el.appendChild(child);
//           renderer(child, state);
//         });
//       }
  
//       if (
//         el.nextElementSibling instanceof this.StateElement &&
//         el.nextElementSibling.getAttribute("data-state-type") === "else"
//       ) {
//         renderer(el.nextElementSibling, state);
//       }
//     }
  
//     handleELSE(el, state, renderer) {
//       if (el.previousElementSibling.getAttribute("data-state-type") !== "if") {
//         throw new Error("Else element must be after if element");
//       }
  
//       if (!el.virtualChild) {
//         el.virtualChild = Array.from(el.children);
//       }
  
//       el.innerHTML = "";
  
//       if (!!!state.state) {
//         el.innerHTML = "";
//         Array.from(el.virtualChild).forEach((child) => {
//           el.appendChild(child);
//           renderer(child, state);
//         });
//       }
//     }
//   }
  