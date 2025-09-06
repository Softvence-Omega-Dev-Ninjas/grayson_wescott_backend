export const sendPrivateMessageSwaggerSchema = {
  type: 'object',
  properties: {
    content: {
      type: 'string',
      example: 'Hey, There how are you?',
    },
    file: {
      type: 'string',
      format: 'binary',
      description: 'Team image/logo file',
    },
  },
  required: ['content'],
};
