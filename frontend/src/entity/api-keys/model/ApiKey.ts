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
  otp: string;
}

export interface RequestOtpResponse {
  status: string;
  recipientMasked: string;
  expiresInSeconds: number;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  keyId: string;
  secret: string;
  encryptionKey?: string;
  workspaceId?: string;
  role: string;
  createdAt: string;
}

export interface GetApiKeysResponse {
  apiKeys: ApiKey[];
}
