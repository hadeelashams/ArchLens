/**
 * useFirestore Hook
 * Direct import alternative to context provider
 * Useful for components that don't use context
 */

import {
  createDocument,
  getDocument,
  getDocuments,
  updateDocument,
  deleteDocument,
  setDocument,
  queryDocuments,
  getUserDocuments,
  batchCreateDocuments,
} from '@archlens/shared';

export const useFirestore = () => {
  return {
    create: createDocument,
    read: getDocument,
    readMany: getDocuments,
    update: updateDocument,
    delete: deleteDocument,
    set: setDocument,
    query: queryDocuments,
    getUserDocs: getUserDocuments,
    batchCreate: batchCreateDocuments,
  };
};

export default useFirestore;
