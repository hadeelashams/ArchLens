# Firestore Integration - Quick Reference

## 🎯 Import Paths

```tsx
// Shared services (available in both apps)
import { 
  createDocument, getDocument, updateDocument, deleteDocument,
  queryDocuments, getUserDocuments 
} from '@archlens/shared';

// Context provider
import { FirestoreProvider, useFirestore } from './context/FirestoreContext';

// Direct hooks
import useFirestore from './hooks/useFirestore';
import { useFirestoreQuery, useFirestoreDocument } from './hooks/useFirestoreQuery';

// Collection services
import { createUser, getUserById, updateUser } from './services/userService';
import { createProject, getProjectEstimates, calculateProjectTotal } from './services/projectService';
```

---

## 💡 Common Use Cases

### Create a User
```tsx
import { createUser } from './services/userService';

const userId = await createUser({
  uid: auth.currentUser?.uid,
  email: 'user@example.com',
  displayName: 'John Doe',
  role: 'user'
});
```

### Get User's Projects
```tsx
import { getUserProjects } from './services/projectService';

const projects = await getUserProjects(userId);
```

### Create an Estimate
```tsx
import { createEstimate } from './services/projectService';

const estimateId = await createEstimate({
  projectId: 'proj123',
  userId: 'user123',
  itemName: 'Concrete Foundation',
  quantity: 100,
  unit: 'cubic meters',
  unitCost: 50,
  totalCost: 5000,
  category: 'Foundation'
});
```

### Query with Filters
```tsx
import { queryDocuments } from '@archlens/shared';

const activeProjects = await queryDocuments('projects', [
  { field: 'userId', operator: '==', value: userId },
  { field: 'status', operator: '==', value: 'active' }
], { field: 'createdAt', direction: 'desc' });
```

### Use in Component (with Hook)
```tsx
import { useFirestoreQuery } from './hooks/useFirestoreQuery';

export const MyComponent = ({ userId }) => {
  const { data: projects, loading, error } = useFirestoreQuery('projects', [
    { field: 'userId', operator: '==', value: userId }
  ]);

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <FlatList
      data={projects}
      renderItem={({ item }) => <Text>{item.name}</Text>}
      keyExtractor={item => item.id}
    />
  );
};
```

### Real-time Updates
```tsx
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@archlens/shared';

useEffect(() => {
  const q = query(
    collection(db, 'projects'),
    where('userId', '==', userId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setProjects(projects);
  });

  return unsubscribe;
}, [userId]);
```

---

## 📊 Data Types

### UserData
```typescript
{
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### ProjectData
```typescript
{
  id?: string;
  userId: string;
  name: string;
  description?: string;
  location?: string;
  status: 'active' | 'archived' | 'completed';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### EstimateData
```typescript
{
  id?: string;
  projectId: string;
  userId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

---

## 🔍 Query Operators

```typescript
'==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any'
```

Example:
```tsx
await queryDocuments('projects', [
  { field: 'status', operator: '==', value: 'active' },
  { field: 'userId', operator: '==', value: userId }
]);
```

---

## ⚡ Performance Tips

1. **Use indexes** for complex queries in Firebase Console
2. **Limit results** to avoid loading too much data
3. **Use real-time listeners** sparingly - they increase costs
4. **Batch operations** when creating/updating multiple documents
5. **Cache data** in component state to minimize reads

---

## 🐛 Debugging

Enable console logging:
```tsx
// In your service
const result = await createDocument('users', data);
console.log('Created user:', result);
```

Check Firestore rules in Firebase Console if you get permission errors.

---

## 🔗 Full Documentation

See `FIRESTORE_INTEGRATION_GUIDE.md` for complete documentation.
