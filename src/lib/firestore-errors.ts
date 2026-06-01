export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: any, operation: OperationType, path?: string) {
  console.error(`Firestore error [${operation}] on ${path || 'unknown'}:`, error);
  return null;
}