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
  
export default State;  