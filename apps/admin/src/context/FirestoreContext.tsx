/**
 * Firestore Context Provider
 * Provides Firestore service methods to all child components
 */

import React, { createContext, useContext, ReactNode } from 'react';
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

interface FirestoreContextType {
  createDocument: typeof createDocument;
  getDocument: typeof getDocument;
  getDocuments: typeof getDocuments;
  updateDocument: typeof updateDocument;
  deleteDocument: typeof deleteDocument;
  setDocument: typeof setDocument;
  queryDocuments: typeof queryDocuments;
  getUserDocuments: typeof getUserDocuments;
  batchCreateDocuments: typeof batchCreateDocuments;
}

const FirestoreContext = createContext<FirestoreContextType | undefined>(undefined);

export const FirestoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const value: FirestoreContextType = {
    createDocument,
    getDocument,
    getDocuments,
    updateDocument,
    deleteDocument,
    setDocument,
    queryDocuments,
    getUserDocuments,
    batchCreateDocuments,
  };

  return (
    <FirestoreContext.Provider value={value}>
      {children}
    </FirestoreContext.Provider>
  );
};

/**
 * Hook to use Firestore context
 * Usage: const firestore = useFirestore();
 */
export const useFirestore = (): FirestoreContextType => {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error('useFirestore must be used within a FirestoreProvider');
  }
  return context;
};
