import {
  CodeOutlined,
  CopyOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Card, Tabs, Tag } from 'antd';
import { useState } from 'react';

import { ClipboardHelper } from '../../../shared/lib/ClipboardHelper';
import { ApiKeysComponent } from '../../api-keys/ui/ApiKeysComponent';

interface Props {
  workspaceId?: string;
  workspaceName?: string;
}

export function ApiDocsComponent({ workspaceId, workspaceName }: Props) {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState('docs');
  const [codeLang, setCodeLang] = useState('curl');

  const currentWorkspaceId = workspaceId || 'YOUR_WORKSPACE_ID';

  const copySnippet = (text: string, label: string) => {
    ClipboardHelper.copyToClipboard(text);
    message.success(`${label} copied to clipboard`);
  };

  const curlCode = `# 1. Authentication Headers:
# X-API-Key: dbs_live_...
# X-API-Secret: dbs_sec_...
# X-Encryption-Key: dbs_enc_... (your one-time secret key)

# 2. Register a Database in your Workspace:
curl -X POST https://api.databasus.com/api/v1/databases \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dbs_live_YOUR_KEY_ID" \\
  -H "X-API-Secret: dbs_sec_YOUR_SECRET" \\
  -d '{
    "workspaceId": "${currentWorkspaceId}",
    "name": "Production Postgres",
    "type": "POSTGRESQL",
    "host": "postgres.internal",
    "port": 5432,
    "dbName": "app_db",
    "dbUsername": "app_user",
    "dbPassword": "your_secure_password"
  }'

# 3. Trigger a Zero-Knowledge Encrypted Backup:
curl -X POST https://api.databasus.com/api/v1/backups \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dbs_live_YOUR_KEY_ID" \\
  -H "X-API-Secret: dbs_sec_YOUR_SECRET" \\
  -H "X-Encryption-Key: dbs_enc_YOUR_SECRET_KEY" \\
  -d '{
    "database_id": "DATABASE_UUID"
  }'

# 4. List Backups:
curl -X GET "https://api.databasus.com/api/v1/backups?database_id=DATABASE_UUID" \\
  -H "X-API-Key: dbs_live_YOUR_KEY_ID" \\
  -H "X-API-Secret: dbs_sec_YOUR_SECRET"

# 5. Restore a Backup:
curl -X POST https://api.databasus.com/api/v1/restores/BACKUP_UUID/restore \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dbs_live_YOUR_KEY_ID" \\
  -H "X-API-Secret: dbs_sec_YOUR_SECRET" \\
  -H "X-Encryption-Key: dbs_enc_YOUR_SECRET_KEY" \\
  -d '{
    "restoreToOriginalDatabase": true
  }'`;

  const tsCode = `import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.databasus.com/api/v1',
  headers: {
    'X-API-Key': process.env.DATABASUS_API_KEY,
    'X-API-Secret': process.env.DATABASUS_API_SECRET,
    'X-Encryption-Key': process.env.DATABASUS_ENCRYPTION_KEY, // generated once
  },
});

// 1. Register a Database in your Workspace
async function registerDatabase() {
  const response = await client.post('/databases', {
    workspaceId: '${currentWorkspaceId}',
    name: 'Production DB',
    type: 'POSTGRESQL',
    host: 'postgres.production',
    port: 5432,
    dbName: 'production',
    dbUsername: 'prod_user',
    dbPassword: process.env.DB_PASSWORD,
  });
  return response.data; // { id: "database-uuid", ... }
}

// 2. Trigger an Encrypted Backup
async function triggerBackup(databaseId: string) {
  const response = await client.post('/backups', {
    database_id: databaseId,
  });
  return response.data;
}

// 3. List Backups
async function listBackups(databaseId: string) {
  const response = await client.get('/backups', {
    params: { database_id: databaseId },
  });
  return response.data;
}

// 4. Restore a Backup
async function restoreBackup(backupId: string) {
  const response = await client.post(\`/restores/\${backupId}/restore\`, {
    restoreToOriginalDatabase: true,
  });
  return response.data;
}`;

  const pythonCode = `import os
import requests

BASE_URL = "https://api.databasus.com/api/v1"
HEADERS = {
    "X-API-Key": os.getenv("DATABASUS_API_KEY"),
    "X-API-Secret": os.getenv("DATABASUS_API_SECRET"),
    "X-Encryption-Key": os.getenv("DATABASUS_ENCRYPTION_KEY"), # generated once
}

# 1. Register a Database in your Workspace
def register_database():
    payload = {
        "workspaceId": "${currentWorkspaceId}",
        "name": "Production DB",
        "type": "POSTGRESQL",
        "host": "postgres.internal",
        "port": 5432,
        "dbName": "production",
        "dbUsername": "app_user",
        "dbPassword": os.getenv("DB_PASSWORD"),
    }
    res = requests.post(f"{BASE_URL}/databases", json=payload, headers=HEADERS)
    res.raise_for_status()
    return res.json()

# 2. Trigger a Zero-Knowledge Encrypted Backup
def trigger_backup(database_id: str):
    res = requests.post(
        f"{BASE_URL}/backups",
        json={"database_id": database_id},
        headers=HEADERS,
    )
    res.raise_for_status()
    return res.json()

# 3. List Backups
def list_backups(database_id: str):
    res = requests.get(
        f"{BASE_URL}/backups",
        params={"database_id": database_id},
        headers=HEADERS,
    )
    res.raise_for_status()
    return res.json()

# 4. Restore a Backup
def restore_backup(backup_id: str):
    res = requests.post(
        f"{BASE_URL}/restores/{backup_id}/restore",
        json={"restoreToOriginalDatabase": True},
        headers=HEADERS,
    )
    res.raise_for_status()
    return res.json()`;

  return (
    <div className="mx-auto max-w-5xl py-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Developer API & Integration
            </h1>
            <Tag color="green">Multi-Tenant SaaS</Tag>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Integrate Databasus backups and restores into your projects using programmatic REST
            APIs.
          </p>
        </div>

        {workspaceId && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase">
                Allocated Workspace
              </div>
              <div className="flex items-center gap-2 font-mono text-xs font-medium text-gray-800 dark:text-gray-200">
                <span>{workspaceName || 'Current Workspace'}</span>
                <span className="text-gray-400">({workspaceId})</span>
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copySnippet(workspaceId, 'Workspace ID')}
            />
          </div>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'docs',
            label: (
              <span>
                <CodeOutlined className="mr-1.5" />
                Integration Guide & API Endpoints
              </span>
            ),
            children: (
              <div className="space-y-6">
                <Alert
                  type="info"
                  showIcon
                  icon={<SafetyCertificateOutlined />}
                  message="Zero-Knowledge Encryption Model"
                  description="Your backups are encrypted using your unique client-side encryption key generated once in your workspace credentials. Super Admins and the platform never store your encryption key and cannot decrypt or read your database data."
                />

                <Card
                  className="dark:border-gray-700 dark:bg-gray-800"
                  title="1. API Authentication & Headers"
                >
                  <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                    Every API request requires your unique API credentials. Provide them in custom
                    HTTP headers or via Bearer authorization:
                  </p>

                  <div className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900">
                    <div className="text-gray-500">// Header format:</div>
                    <div className="text-blue-600 dark:text-blue-400">
                      X-API-Key: dbs_live_&lt;your_key_id&gt;
                    </div>
                    <div className="text-blue-600 dark:text-blue-400">
                      X-API-Secret: dbs_sec_&lt;your_secret&gt;
                    </div>
                    <div className="text-red-600 dark:text-red-400">
                      X-Encryption-Key: dbs_enc_&lt;your_encryption_key&gt; (required for backup
                      &amp; restore)
                    </div>
                  </div>
                </Card>

                <Card
                  className="dark:border-gray-700 dark:bg-gray-800"
                  title="2. Code Integration Examples"
                  extra={
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        type={codeLang === 'curl' ? 'primary' : 'default'}
                        onClick={() => setCodeLang('curl')}
                      >
                        cURL
                      </Button>
                      <Button
                        size="small"
                        type={codeLang === 'typescript' ? 'primary' : 'default'}
                        onClick={() => setCodeLang('typescript')}
                      >
                        TypeScript / Node
                      </Button>
                      <Button
                        size="small"
                        type={codeLang === 'python' ? 'primary' : 'default'}
                        onClick={() => setCodeLang('python')}
                      >
                        Python
                      </Button>
                    </div>
                  }
                >
                  <div className="relative">
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      className="absolute top-2 right-2 z-10"
                      onClick={() => {
                        const snippet =
                          codeLang === 'curl'
                            ? curlCode
                            : codeLang === 'typescript'
                              ? tsCode
                              : pythonCode;
                        copySnippet(snippet, 'Code snippet');
                      }}
                    >
                      Copy
                    </Button>
                    <pre className="overflow-x-auto rounded bg-gray-900 p-4 font-mono text-xs text-gray-100 dark:bg-black">
                      <code>
                        {codeLang === 'curl'
                          ? curlCode
                          : codeLang === 'typescript'
                            ? tsCode
                            : pythonCode}
                      </code>
                    </pre>
                  </div>
                </Card>

                <Card
                  className="dark:border-gray-700 dark:bg-gray-800"
                  title="3. Endpoint Reference"
                >
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
                      <Tag color="blue" className="font-mono">
                        POST
                      </Tag>
                      <code className="font-mono font-semibold">/api/v1/databases</code>
                      <span className="text-gray-500">
                        Register a new project database in your workspace
                      </span>
                    </div>
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
                      <Tag color="green" className="font-mono">
                        GET
                      </Tag>
                      <code className="font-mono font-semibold">
                        /api/v1/databases?workspace_id=...
                      </code>
                      <span className="text-gray-500">
                        List all databases in your allocated workspace
                      </span>
                    </div>
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
                      <Tag color="blue" className="font-mono">
                        POST
                      </Tag>
                      <code className="font-mono font-semibold">/api/v1/backups</code>
                      <span className="text-gray-500">
                        Trigger an encrypted backup using your encryption key
                      </span>
                    </div>
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
                      <Tag color="green" className="font-mono">
                        GET
                      </Tag>
                      <code className="font-mono font-semibold">
                        /api/v1/backups?database_id=...
                      </code>
                      <span className="text-gray-500">
                        List backups and monitor completion status
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pb-1">
                      <Tag color="blue" className="font-mono">
                        POST
                      </Tag>
                      <code className="font-mono font-semibold">
                        /api/v1/restores/:backupId/restore
                      </code>
                      <span className="text-gray-500">
                        Restore a backup using your encryption key
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'keys',
            label: (
              <span>
                <KeyOutlined className="mr-1.5" />
                API Credentials &amp; Encryption Key
              </span>
            ),
            children: (
              <div className="space-y-4">
                <Alert
                  type="warning"
                  showIcon
                  icon={<LockOutlined />}
                  message="Keep your API Secret & One-Time Encryption Key safe"
                  description="When you create an API Key, an Encryption Key is generated alongside it. This key is displayed only once. Store both securely in your project's environment variables."
                />
                <ApiKeysComponent workspaceId={workspaceId} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
