import { StateManager } from "./state.js";
declare global {
  interface Window {
    StateManager: StateManager;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.StateManager = new StateManager(document.body);
});
