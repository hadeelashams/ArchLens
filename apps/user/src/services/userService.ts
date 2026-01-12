/**
 * User Service - Collection-specific operations
 * Handles all user-related database operations
 */

import {
  createDocument,
  getDocument,
  queryDocuments,
  updateDocument,
  deleteDocument,
  getUserDocuments,
} from '@archlens/shared';

export interface UserData {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION = 'users';

/**
 * Create new user profile
 */
export const createUser = async (userData: UserData): Promise<string> => {
  return createDocument(COLLECTION, userData);
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<UserData | null> => {
  const data = await getDocument(COLLECTION, userId);
  return data as UserData | null;
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<UserData | null> => {
  const users = await queryDocuments(COLLECTION, [
    { field: 'email', operator: '==', value: email },
  ]);
  return users.length > 0 ? (users[0] as UserData) : null;
};

/**
 * Update user profile
 */
export const updateUser = async (userId: string, updates: Partial<UserData>): Promise<void> => {
  return updateDocument(COLLECTION, userId, updates);
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<void> => {
  return deleteDocument(COLLECTION, userId);
};

export default {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
};
