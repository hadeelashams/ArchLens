# Firestore Integration Guide - ArchLens

## Overview
Your entire codebase is now fully integrated with Google Cloud Firestore. This guide explains how to use the Firestore integration in your Admin and User applications.

---

## Architecture

### Core Services (in `packages/shared`)
- **`firebase.ts`** - Firebase initialization with Auth and Firestore
- **`firestore-service.ts`** - Generic CRUD operations and utilities

### App-Specific Services
- **Admin & User Apps** have:
  - `services/userService.ts` - User profile operations
  - `services/projectService.ts` - Project and estimate management
  - `context/FirestoreContext.tsx` - React Context provider
  - `hooks/useFirestore.ts` - Hook for direct access

---

## How to Use Firestore

### Option 1: Using the Context Provider (Recommended)

The `FirestoreProvider` wraps your entire app and provides access to Firestore services via the `useFirestore` hook.

```tsx
// In any component within the app
import { useFirestore } from '../context/FirestoreContext';

export default function MyComponent() {
  const firestore = useFirestore();

  const handleCreateUser = async () => {
    try {
      const userId = await firestore.createDocument('users', {
        email: 'user@example.com',
        displayName: 'John Doe',
        role: 'user'
      });
      console.log('User created:', userId);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handleCreateUser}>
      <Text>Create User</Text>
    </TouchableOpacity>
  );
}
```

### Option 2: Using the Hook Directly

```tsx
import useFirestore from '../hooks/useFirestore';

export default function MyComponent() {
  const { create, read, update, delete: remove } = useFirestore();

  // Usage
  await create('users', userData);
  const user = await read('users', userId);
  await update('users', userId, updates);
  await remove('users', userId);
}
```

### Option 3: Using Collection-Specific Services

For type-safe operations with predefined interfaces:

```tsx
import { createProject, getUserProjects, updateProject } from '../services/projectService';
import { createUser, getUserById } from '../services/userService';

// Create a new project
const projectId = await createProject({
  userId: 'user123',
  name: 'Home Renovation',
  description: 'Kitchen remodel project',
  location: 'New York, NY',
  status: 'active'
});

// Get user's projects
const projects = await getUserProjects('user123');

// Update a project
await updateProject(projectId, {
  status: 'completed'
});

// Get user by ID
const user = await getUserById('user123');
```

---

## Available Services

### Generic Firestore Service

**Location:** `@archlens/shared`

```typescript
import {
  createDocument,      // Create new doc with auto ID
  getDocument,         // Get single document
  getDocuments,        // Get multiple documents
  updateDocument,      // Update existing document
  deleteDocument,      // Delete document
  setDocument,         // Set or merge document
  queryDocuments,      // Query with filters
  getUserDocuments,    // Get docs by user ID
  batchCreateDocuments // Create multiple documents
} from '@archlens/shared';
```

### User Service

**Location:** `./services/userService.ts`

```typescript
createUser(userData)        // Create user profile
getUserById(userId)         // Get user by ID
getUserByEmail(email)       // Get user by email
updateUser(userId, updates) // Update user
deleteUser(userId)          // Delete user
```

### Project Service

**Location:** `./services/projectService.ts`

```typescript
// Projects
createProject(projectData)
getProjectById(projectId)
getUserProjects(userId)
updateProject(projectId, updates)
deleteProject(projectId)

// Estimates
createEstimate(estimateData)
getEstimateById(estimateId)
getProjectEstimates(projectId)
getUserEstimates(userId)
updateEstimate(estimateId, updates)
deleteEstimate(estimateId)

// Utilities
calculateProjectTotal(projectId) // Calculate total project cost
```

---

## Database Schema

### Collections

#### `users`
```typescript
{
  uid: string              // Firebase Auth UID
  email: string           // User email
  displayName: string     // Display name
  role: 'admin' | 'user'  // User role
  createdAt: timestamp    // Auto-generated
  updatedAt: timestamp    // Auto-generated
}
```

#### `projects`
```typescript
{
  userId: string                                 // User ID
  name: string                                   // Project name
  description?: string                           // Project description
  location?: string                              // Project location
  status: 'active' | 'archived' | 'completed'   // Project status
  createdAt: timestamp                           // Auto-generated
  updatedAt: timestamp                           // Auto-generated
}
```

#### `estimates`
```typescript
{
  projectId: string      // Associated project
  userId: string         // User ID
  itemName: string       // Item/material name
  quantity: number       // Quantity
  unit: string          // Unit of measurement
  unitCost: number      // Cost per unit
  totalCost: number     // Total cost (quantity * unitCost)
  category: string      // Category/type
  notes?: string        // Additional notes
  createdAt: timestamp  // Auto-generated
  updatedAt: timestamp  // Auto-generated
}
```

---

## Examples

### Creating a User and Project

```tsx
import { useFirestore } from '../context/FirestoreContext';
import { createProject } from '../services/projectService';

export default function CreateProjectScreen() {
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);

  const handleCreateProject = async (userId: string, projectName: string) => {
    setLoading(true);
    try {
      // Create project using service
      const projectId = await createProject({
        userId,
        name: projectName,
        status: 'active',
        location: 'New York'
      });

      Alert.alert('Success', `Project created: ${projectId}`);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Component JSX
  );
}
```

### Querying Projects with Filters

```tsx
import { queryDocuments } from '@archlens/shared';

// Get all active projects for a user
const activeProjects = await queryDocuments('projects', [
  { field: 'userId', operator: '==', value: userId },
  { field: 'status', operator: '==', value: 'active' }
], { field: 'createdAt', direction: 'desc' });
```

### Real-time Updates with Listeners

For real-time database updates, you can use Firestore's `onSnapshot`:

```tsx
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@archlens/shared';

useEffect(() => {
  const q = query(
    collection(db, 'projects'),
    where('userId', '==', currentUser.uid)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setProjects(projects);
  });

  return unsubscribe; // Cleanup
}, [currentUser.uid]);
```

---

## Security Rules

Ensure your Firestore Security Rules are properly configured in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own documents
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Users can read/write their own projects and estimates
    match /projects/{projectId} {
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth.uid == 
                                      resource.data.userId;
    }

    match /estimates/{estimateId} {
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth.uid == 
                                      resource.data.userId;
    }
  }
}
```

---

## Environment Variables

Make sure your `.env` file contains all Firebase configuration:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## Troubleshooting

### Issue: "useFirestore must be used within a FirestoreProvider"
**Solution:** Ensure your component is wrapped by `FirestoreProvider` in the app's root component.

### Issue: "Firestore initialization error"
**Solution:** Verify your `.env` variables are correctly set and Firebase project is active.

### Issue: "Permission denied" errors
**Solution:** Check your Firestore Security Rules in the Firebase Console.

---

## Next Steps

1. **Implement user authentication** in LoginScreen and RegisterScreen
2. **Create project management UI** using the projectService
3. **Add real-time listeners** for live data updates
4. **Configure Firestore indexes** for complex queries
5. **Set up proper security rules** in Firebase Console

---

## Support

For more information:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [React Native Firebase](https://rnfirebase.io/)
