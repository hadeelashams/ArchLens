/**
 * Firestore Service - Centralized database operations
 * Provides common CRUD operations and queries for the entire ArchLens application
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  addDoc,
  serverTimestamp,
  DocumentData,
  Query,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Generic Create Operation
 * Adds a new document with auto-generated ID
 */
export const createDocument = async (
  collectionName: string,
  data: Record<string, any>
): Promise<string> => {
  try {
    const docRef = await addDoc(
      collection(db, collectionName),
      {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Generic Read Operation - Get single document
 */
export const getDocument = async (
  collectionName: string,
  docId: string
): Promise<DocumentData | null> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error(`Error reading document from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Generic Read Operation - Get multiple documents with filters
 */
export const getDocuments = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<DocumentData[]> => {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error(`Error reading documents from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Generic Update Operation
 */
export const updateDocument = async (
  collectionName: string,
  docId: string,
  data: Record<string, any>
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Generic Delete Operation
 */
export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Set or overwrite document (useful for batch operations)
 */
export const setDocument = async (
  collectionName: string,
  docId: string,
  data: Record<string, any>,
  merge: boolean = false
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(
      docRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge }
    );
  } catch (error) {
    console.error(`Error setting document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Query documents with multiple filters
 */
export const queryDocuments = async (
  collectionName: string,
  filters: Array<{ field: string; operator: any; value: any }> = [],
  orderByField?: { field: string; direction?: 'asc' | 'desc' },
  limitCount?: number
): Promise<DocumentData[]> => {
  try {
    const constraints: QueryConstraint[] = [];

    // Add filters
    filters.forEach(({ field, operator, value }) => {
      constraints.push(where(field, operator, value));
    });

    // Add ordering
    if (orderByField) {
      constraints.push(orderBy(orderByField.field, orderByField.direction || 'asc'));
    }

    // Add limit
    if (limitCount) {
      constraints.push(limit(limitCount));
    }

    return await getDocuments(collectionName, constraints);
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get documents by user ID (common pattern)
 */
export const getUserDocuments = async (
  collectionName: string,
  userId: string
): Promise<DocumentData[]> => {
  return queryDocuments(collectionName, [
    { field: 'userId', operator: '==', value: userId },
  ]);
};

/**
 * Batch create multiple documents
 */
export const batchCreateDocuments = async (
  collectionName: string,
  documents: Record<string, any>[]
): Promise<string[]> => {
  try {
    const ids: string[] = [];
    for (const doc of documents) {
      const id = await createDocument(collectionName, doc);
      ids.push(id);
    }
    return ids;
  } catch (error) {
    console.error(`Error batch creating documents in ${collectionName}:`, error);
    throw error;
  }
};

export default {
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
