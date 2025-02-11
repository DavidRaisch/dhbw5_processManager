export default {
    __init__: ['customRules'],
    customRules: ['type', CustomRules]
  };
  
  function CustomRules(eventBus, bpmnRules) {
    // Add a custom rule for deleting elements.
    bpmnRules.addRule('elements.delete', 1500, (context) => {
      const { elements } = context;
      if (!elements) {
        return true;
      }
      // Block deletion if any element's business object id is "StartEvent_1"
      return elements.every(element => {
        if (element.businessObject && element.businessObject.id === 'StartEvent_1') {
          return false;
        }
        return true;
      });
    });
  }
  
  CustomRules.$inject = ['eventBus', 'bpmnRules'];
  