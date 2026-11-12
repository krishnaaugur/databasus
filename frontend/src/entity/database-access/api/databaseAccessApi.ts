import { getApplicationServer } from '../../../constants';
import { apiHelper } from '../../../shared/api/apiHelper';
import RequestOptions from '../../../shared/api/RequestOptions';
import type { DatabaseAccessControl, SetDatabaseAccessRequest } from '../model/DatabaseAccess';

export const databaseAccessApi = {
  async listPermissions(databaseId: string, workspaceId: string): Promise<DatabaseAccessControl[]> {
    const requestOptions = new RequestOptions();
    const url = `${getApplicationServer()}/api/v1/databases/${databaseId}/permissions?workspace_id=${encodeURIComponent(workspaceId)}`;
    const res = await apiHelper.fetchGetJson<{ permissions: DatabaseAccessControl[] }>(url, requestOptions);
    return res.permissions || [];
  },

  async setPermissions(
    databaseId: string,
    workspaceId: string,
    request: SetDatabaseAccessRequest,
  ): Promise<void> {
    const requestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify({ workspaceId, ...request }));
    const url = `${getApplicationServer()}/api/v1/databases/${databaseId}/permissions`;
    await apiHelper.fetchPostJson(url, requestOptions);
  },

  async deletePermission(databaseId: string, permId: string, workspaceId: string): Promise<void> {
    const requestOptions = new RequestOptions();
    const url = `${getApplicationServer()}/api/v1/databases/${databaseId}/permissions/${permId}?workspace_id=${encodeURIComponent(workspaceId)}`;
    await apiHelper.fetchDeleteJson(url, requestOptions);
  },
};
