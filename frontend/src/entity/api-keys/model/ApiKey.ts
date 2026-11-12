export interface ApiKey {
  id: string;
  name: string;
  keyId: string;
  workspaceId?: string;
  role: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  workspaceId?: string;
  role?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  keyId: string;
  secret: string;
  workspaceId?: string;
  role: string;
  createdAt: string;
}

export interface GetApiKeysResponse {
  apiKeys: ApiKey[];
}

