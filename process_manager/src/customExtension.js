export const customExtension = {
    name: 'CustomExtension',
    uri: 'http://example.com/schema/bpmn/role',
    prefix: 'role',
    xml: {
      tagAlias: 'lowerCase'
    },
    types: [
      {
        name: 'customExtension',
        extends: ['bpmn:BaseElement'],
        properties: [
          {
            name: 'role',
            isAttr: true,
            type: 'String'
          },
          {
            name: 'description',  
            isAttr: true,
            type: 'String'
          }
        ]
      }
    ]
  };
  