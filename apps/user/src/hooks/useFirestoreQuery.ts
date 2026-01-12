/**
 * useFirestoreQuery Hook
 * Handles Firestore queries with loading and error states
 * Useful for fetching data with UI state management
 */

import { useState, useEffect } from 'react';
import { queryDocuments } from '@archlens/shared';
import { QueryConstraint } from 'firebase/firestore';

interface UseFirestoreQueryOptions {
  constraints?: QueryConstraint[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
  limit?: number;
  autoFetch?: boolean; // Auto-fetch on mount
}

export const useFirestoreQuery = (
  collectionName: string,
  filters: Array<{ field: string; operator: any; value: any }> = [],
  options: UseFirestoreQueryOptions = {}
) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(options.autoFetch !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await queryDocuments(
        collectionName,
        filters,
        options.orderBy,
        options.limit
      );
      setData(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetch();
    }
  }, [collectionName, JSON.stringify(filters)]);

  return { data, loading, error, refetch: fetch };
};

/**
 * useFirestoreDocument Hook
 * Fetch a single document from Firestore
 */
import { getDocument } from '@archlens/shared';

interface UseFirestoreDocumentOptions {
  autoFetch?: boolean;
}

export const useFirestoreDocument = (
  collectionName: string,
  docId: string | null,
  options: UseFirestoreDocumentOptions = {}
) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(!!docId && options.autoFetch !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getDocument(collectionName, docId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (docId && options.autoFetch !== false) {
      fetch();
    }
  }, [collectionName, docId]);

  return { data, loading, error, refetch: fetch };
};

export default {
  useFirestoreQuery,
  useFirestoreDocument,
};
