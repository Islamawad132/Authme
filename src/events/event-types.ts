export const LoginEventType = {
  LOGIN: 'LOGIN',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_REFRESH_ERROR: 'TOKEN_REFRESH_ERROR',
  CODE_TO_TOKEN: 'CODE_TO_TOKEN',
  CODE_TO_TOKEN_ERROR: 'CODE_TO_TOKEN_ERROR',
  CLIENT_LOGIN: 'CLIENT_LOGIN',
  CLIENT_LOGIN_ERROR: 'CLIENT_LOGIN_ERROR',
  FEDERATED_LOGIN: 'FEDERATED_LOGIN',
  MFA_CHALLENGE: 'MFA_CHALLENGE',
  MFA_VERIFY: 'MFA_VERIFY',
  MFA_VERIFY_ERROR: 'MFA_VERIFY_ERROR',
  PASSWORD_RESET: 'PASSWORD_RESET',
  DEVICE_CODE_TO_TOKEN: 'DEVICE_CODE_TO_TOKEN',
} as const;

export type LoginEventTypeValue = (typeof LoginEventType)[keyof typeof LoginEventType];

export const OperationType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export const ResourceType = {
  USER: 'USER',
  CLIENT: 'CLIENT',
  REALM: 'REALM',
  ROLE: 'ROLE',
  GROUP: 'GROUP',
  SCOPE: 'SCOPE',
  IDP: 'IDP',
} as const;

export type ResourceTypeValue = (typeof ResourceType)[keyof typeof ResourceType];
