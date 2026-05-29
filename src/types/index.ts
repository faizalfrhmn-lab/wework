export interface AppUser {
  uid: string;
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  user_metadata?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'superadmin' | 'manager' | 'staff';
  createdAt: string;
  tempPassword?: string;
}

export interface OrganizationSettings {
  revenueEnabledCategories: string[];
  revenueEnabledDivisions: string[];
}

export interface Organization {
  id: string;
  name: string;
  managerId: string;
  members: string[]; // List of UIDs
  settings?: OrganizationSettings;
  createdAt: any;
}

// "Folder" in DB is "Division" in UI
export interface Division {
  id: string;
  organizationId: string;
  members: string[];
  name: string;
  description?: string;
  createdAt: any;
}

export type Folder = Division; // Alias for backward compatibility if needed

export interface SubTask {
  id: string;
  taskId: string;
  organizationId: string;
  members: string[];
  title: string;
  description?: string;
  url?: string;
  completed: boolean;
  initialAmount?: number;
  closingCount?: number;
  closingAmount?: number;
  proofUrl?: string;
  createdAt: any;
}

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'revision' | 'done';

export interface Task {
  id: string;
  folderId: string; // This refers to the Division ID
  organizationId: string;
  members: string[];
  title: string;
  note?: string;
  category?: string;
  initialAmount?: number;
  amount?: number; // Total revenue from sub-tasks
  status: TaskStatus;
  assigneeId?: string;
  assigneeIds?: string[];
  deadline: string;
  progress: number;
  completedAt?: any;
  createdAt: any;
  createdBy?: string; 
}

export interface LibraryFolder {
  id: string;
  divisionId: string;
  parentId: string | null;
  name: string;
  members: string[];
  createdAt: any;
}

export interface LibraryItem {
  id: string;
  divisionId: string;
  libraryFolderId: string | null;
  taskId: string | null;
  source: 'task' | 'manual';
  url: string;
  label: string;
  members: string[];
  createdAt: any;
}

export type TaskLink = LibraryItem; // Alias

export interface Message {
  id: string;
  organizationId: string;
  divisionId?: string | null;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  taggedTaskId?: string | null;
  taggedTaskDivisionId?: string | null;
  taggedTaskTitle?: string | null;
  members: string[]; // List of UIDs who can see this
  createdAt: any;
}

export type NotificationType = 'message' | 'task_assignment' | 'task_status' | 'deadline';

export interface AppNotification {
  id: string;
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: {
    view: 'folders' | 'chat' | 'dashboard';
    divisionId?: string;
    taskId?: string;
    scrollTo?: 'comments';
  };
  read: boolean;
  createdAt: any;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}
