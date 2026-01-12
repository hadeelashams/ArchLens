/**
 * Project Service - Collection-specific operations
 * Handles all construction project and estimate-related database operations
 */

import {
  createDocument,
  getDocument,
  queryDocuments,
  updateDocument,
  deleteDocument,
  getUserDocuments,
} from '@archlens/shared';

export interface ProjectData {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  location?: string;
  status: 'active' | 'archived' | 'completed';
  createdAt?: any;
  updatedAt?: any;
}

export interface EstimateData {
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
  createdAt?: any;
  updatedAt?: any;
}

const PROJECTS_COLLECTION = 'projects';
const ESTIMATES_COLLECTION = 'estimates';

// ===== PROJECT OPERATIONS =====

/**
 * Create new project
 */
export const createProject = async (projectData: ProjectData): Promise<string> => {
  return createDocument(PROJECTS_COLLECTION, projectData);
};

/**
 * Get project by ID
 */
export const getProjectById = async (projectId: string): Promise<ProjectData | null> => {
  const data = await getDocument(PROJECTS_COLLECTION, projectId);
  return data as ProjectData | null;
};

/**
 * Get all projects for a user
 */
export const getUserProjects = async (userId: string): Promise<ProjectData[]> => {
  const docs = await getUserDocuments(PROJECTS_COLLECTION, userId);
  return docs as ProjectData[];
};

/**
 * Update project
 */
export const updateProject = async (projectId: string, updates: Partial<ProjectData>): Promise<void> => {
  return updateDocument(PROJECTS_COLLECTION, projectId, updates);
};

/**
 * Delete project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  return deleteDocument(PROJECTS_COLLECTION, projectId);
};

// ===== ESTIMATE OPERATIONS =====

/**
 * Create new estimate/cost item
 */
export const createEstimate = async (estimateData: EstimateData): Promise<string> => {
  return createDocument(ESTIMATES_COLLECTION, estimateData);
};

/**
 * Get estimate by ID
 */
export const getEstimateById = async (estimateId: string): Promise<EstimateData | null> => {
  const data = await getDocument(ESTIMATES_COLLECTION, estimateId);
  return data as EstimateData | null;
};

/**
 * Get all estimates for a project
 */
export const getProjectEstimates = async (projectId: string): Promise<EstimateData[]> => {
  const docs = await queryDocuments(ESTIMATES_COLLECTION, [
    { field: 'projectId', operator: '==', value: projectId },
  ]);
  return docs as EstimateData[];
};

/**
 * Get all estimates for a user
 */
export const getUserEstimates = async (userId: string): Promise<EstimateData[]> => {
  const docs = await getUserDocuments(ESTIMATES_COLLECTION, userId);
  return docs as EstimateData[];
};

/**
 * Update estimate
 */
export const updateEstimate = async (estimateId: string, updates: Partial<EstimateData>): Promise<void> => {
  return updateDocument(ESTIMATES_COLLECTION, estimateId, updates);
};

/**
 * Delete estimate
 */
export const deleteEstimate = async (estimateId: string): Promise<void> => {
  return deleteDocument(ESTIMATES_COLLECTION, estimateId);
};

/**
 * Calculate total project cost
 */
export const calculateProjectTotal = async (projectId: string): Promise<number> => {
  const estimates = await getProjectEstimates(projectId);
  return estimates.reduce((sum, est) => sum + (est.totalCost || 0), 0);
};

export default {
  createProject,
  getProjectById,
  getUserProjects,
  updateProject,
  deleteProject,
  createEstimate,
  getEstimateById,
  getProjectEstimates,
  getUserEstimates,
  updateEstimate,
  deleteEstimate,
  calculateProjectTotal,
};
