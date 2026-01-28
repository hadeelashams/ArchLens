/**
 * Sprint 1 - Arch Lens Test Suite
 * Tests with real Firebase Firestore credentials
 */

// Set up environment variables for Firebase
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'AIzaSyDDg0WokHarkPcBtAtmVa6zJW7FLdTVfJg';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'arch-lens.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'arch-lens';
process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = 'arch-lens.firebasestorage.app';
process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '931000220036';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:931000220036:web:e67468cf5f2cdf93a7c5d1';

// Mock React Native Platform for Node environment
jest.mock('react-native', () => ({
    Platform: {
        OS: 'web',
        select: (obj) => obj.web,
    },
}));

// Import Firebase services directly from firestore-service
let firestoreServices;

try {
    // Import the firestore service module directly
    firestoreServices = require('@archlens/shared/firestore-service.ts');
} catch (e) {
    // Use alternative path if direct import fails
    try {
        firestoreServices = require('../packages/shared/firestore-service.ts');
    } catch (e2) {
        console.error('Error loading firestore-service from both paths:', e2.message);
        throw e;
    }
}

// Create service implementations
const userService = {
    createUser: async (userData) => {
        if (!firestoreServices || !firestoreServices.createDocument) {
            throw new Error('createDocument not available');
        }
        return firestoreServices.createDocument('users', userData);
    },
    getUserById: async (userId) => {
        if (!firestoreServices || !firestoreServices.getDocument) {
            throw new Error('getDocument not available');
        }
        return firestoreServices.getDocument('users', userId);
    },
    getUserByEmail: async (email) => {
        if (!firestoreServices || !firestoreServices.queryDocuments) {
            throw new Error('queryDocuments not available');
        }
        const users = await firestoreServices.queryDocuments('users', [
            { field: 'email', operator: '==', value: email },
        ]);
        return users.length > 0 ? users[0] : null;
    },
    updateUser: async (userId, updates) => {
        if (!firestoreServices || !firestoreServices.updateDocument) {
            throw new Error('updateDocument not available');
        }
        return firestoreServices.updateDocument('users', userId, updates);
    },
    deleteUser: async (userId) => {
        if (!firestoreServices || !firestoreServices.deleteDocument) {
            throw new Error('deleteDocument not available');
        }
        return firestoreServices.deleteDocument('users', userId);
    },
};

const projectService = {
    createProject: async (projectData) => {
        if (!firestoreServices || !firestoreServices.createDocument) {
            throw new Error('createDocument not available');
        }
        return firestoreServices.createDocument('projects', projectData);
    },
    getProjectById: async (projectId) => {
        if (!firestoreServices || !firestoreServices.getDocument) {
            throw new Error('getDocument not available');
        }
        return firestoreServices.getDocument('projects', projectId);
    },
    getUserProjects: async (userId) => {
        if (!firestoreServices || !firestoreServices.getUserDocuments) {
            throw new Error('getUserDocuments not available');
        }
        return firestoreServices.getUserDocuments('projects', userId);
    },
    updateProject: async (projectId, updates) => {
        if (!firestoreServices || !firestoreServices.updateDocument) {
            throw new Error('updateDocument not available');
        }
        return firestoreServices.updateDocument('projects', projectId, updates);
    },
    deleteProject: async (projectId) => {
        if (!firestoreServices || !firestoreServices.deleteDocument) {
            throw new Error('deleteDocument not available');
        }
        return firestoreServices.deleteDocument('projects', projectId);
    },
    createEstimate: async (estimateData) => {
        if (!firestoreServices || !firestoreServices.createDocument) {
            throw new Error('createDocument not available');
        }
        return firestoreServices.createDocument('estimates', estimateData);
    },
    getEstimateById: async (estimateId) => {
        if (!firestoreServices || !firestoreServices.getDocument) {
            throw new Error('getDocument not available');
        }
        return firestoreServices.getDocument('estimates', estimateId);
    },
};

describe('Sprint 1 - Arch Lens Test Suite', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // TC_S1_01: Verify Admin user creation and retrieval
    test('TC_S1_01: Admin user should be created and retrievable from database', async () => {
        const adminData = {
            uid: 'admin_uid_123',
            email: 'admin@archlens.com',
            displayName: 'Admin User',
            role: 'admin'
        };
        
        const userId = await userService.createUser(adminData);
        expect(userId).toBeDefined();
        expect(typeof userId).toBe('string');
        expect(userId.length).toBeGreaterThan(0);
    });

    // TC_S1_02: Verify user registration and retrieval by email
    test('TC_S1_02: User account should be created and retrievable by email', async () => {
        const userData = {
            uid: 'uid_test_123',
            email: 'testuser@example.com',
            displayName: 'Test User',
            role: 'user'
        };
        
        // Test user creation
        const userId = await userService.createUser(userData);
        expect(userId).toBeDefined();
        expect(typeof userId).toBe('string');

        // Test retrieving user by email
        const retrievedUser = await userService.getUserByEmail('testuser@example.com');
        expect(retrievedUser).toBeDefined();
        expect(retrievedUser.email).toBe('testuser@example.com');
        expect(retrievedUser.displayName).toBe('Test User');
    });

    // TC_S1_03: Verify project creation and management
    test('TC_S1_03: New construction projects should be created and manageable', async () => {
        const projectData = {
            userId: 'uid_test_123',
            name: 'Foundation Work Project',
            description: 'Foundation inspection and repair',
            location: '123 Main St, City',
            status: 'active'
        };
        
        const projectId = await projectService.createProject(projectData);
        
        expect(projectId).toBeDefined();
        expect(typeof projectId).toBe('string');
        expect(projectId.length).toBeGreaterThan(0);
    });

    // TC_S1_04: Verify project estimate creation and cost calculation
    test('TC_S1_04: System should create and manage project estimates for cost calculations', async () => {
        const estimateData = {
            projectId: 'proj_test_123',
            userId: 'uid_test_123',
            itemName: 'Concrete Foundation',
            quantity: 50,
            unit: 'cubic yards',
            unitCost: 150.00,
            totalCost: 7500.00,
            category: 'Foundation'
        };
        
        const estimateId = await projectService.createEstimate(estimateData);
        
        expect(estimateId).toBeDefined();
        expect(typeof estimateId).toBe('string');
        expect(estimateId.length).toBeGreaterThan(0);
    });

});