import { getApplicationServer } from '../../../constants';
import { apiHelper } from '../../../shared/api/apiHelper';
import RequestOptions from '../../../shared/api/RequestOptions';
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  GetApiKeysResponse,
  RequestOtpResponse,
} from '../model/ApiKey';

export const apiKeysApi = {
  async requestOtp(workspaceId: string): Promise<RequestOtpResponse> {
    const requestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify({ workspaceId }));
    const url = `${getApplicationServer()}/api/v1/api-keys/otp/request`;
    return apiHelper.fetchPostJson<RequestOtpResponse>(url, requestOptions);
  },

  async getApiKeys(workspaceId?: string): Promise<ApiKey[]> {
    const requestOptions = new RequestOptions();
    let url = `${getApplicationServer()}/api/v1/api-keys`;
    if (workspaceId) {
      url += `?workspace_id=${encodeURIComponent(workspaceId)}`;
    }
    const response = await apiHelper.fetchGetJson<GetApiKeysResponse>(url, requestOptions);
    return response.apiKeys || [];
  },

  async createApiKey(request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const requestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(request));
    const url = `${getApplicationServer()}/api/v1/api-keys`;
    return apiHelper.fetchPostJson<CreateApiKeyResponse>(url, requestOptions);
  },

  async revokeApiKey(id: string): Promise<void> {
    const requestOptions = new RequestOptions();
    const url = `${getApplicationServer()}/api/v1/api-keys/${id}`;
    await apiHelper.fetchDeleteJson(url, requestOptions);
  },
};
