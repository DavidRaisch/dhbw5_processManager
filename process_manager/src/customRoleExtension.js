export const customRoleExtension = {
    name: 'CustomRoleExtension',
    uri: 'http://example.com/schema/bpmn/role',
    prefix: 'role',
    xml: {
      tagAlias: 'lowerCase'
    },
    types: [
      {
        name: 'Role',
        extends: ['bpmn:BaseElement'],
        properties: [
          {
            name: 'role',
            isAttr: true,
            type: 'String'
          }
        ]
      }
    ]
  };
  