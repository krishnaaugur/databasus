export interface DatabaseAccessControl {
  id: string;
  databaseId: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  apiKeyId?: string;
  apiKeyName?: string;
  apiKeyPublic?: string;
  canView: boolean;
  canBackup: boolean;
  canRestore: boolean;
  canManage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SetDatabaseAccessRequest {
  userId?: string;
  apiKeyId?: string;
  canView: boolean;
  canBackup: boolean;
  canRestore: boolean;
  canManage: boolean;
}

