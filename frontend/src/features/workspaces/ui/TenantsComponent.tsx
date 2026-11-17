/* eslint-disable i18next/no-literal-string -- Tenants screen UI */
import {
  ApartmentOutlined,
  DatabaseOutlined,
  EyeOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Input,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { WorkspaceRole } from '../../../entity/users';
import {
  type WorkspaceResponse,
  type WorkspaceTelemetry,
  workspaceApi,
} from '../../../entity/workspaces';
import { TenantDetailsDrawerComponent } from './TenantDetailsDrawerComponent';

const { Title, Text } = Typography;

interface Props {
  workspaces: WorkspaceResponse[];
  contentHeight: number;
  onCreateTenant: () => void;
  onRefreshWorkspaces: () => Promise<void>;
}

export function TenantsComponent({
  workspaces,
  contentHeight,
  onCreateTenant,
  onRefreshWorkspaces,
}: Props) {
  const { message } = App.useApp();
  const [telemetries, setTelemetries] = useState<Record<string, WorkspaceTelemetry>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenantForDetails, setSelectedTenantForDetails] =
    useState<WorkspaceResponse | null>(null);

  const loadTelemetries = async () => {
    setIsLoading(true);
    try {
      const data = await workspaceApi.getAllWorkspacesTelemetry();
      const telemetryMap: Record<string, WorkspaceTelemetry> = {};
      data.forEach((item) => {
        telemetryMap[item.workspaceId] = item;
      });
      setTelemetries(telemetryMap);
    } catch {
      // Non-fatal, workspaces list is still viewable
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTelemetries();
  }, [workspaces]);

  const handleRefresh = async () => {
    await Promise.all([onRefreshWorkspaces(), loadTelemetries()]);
    message.success('Tenants refreshed');
  };

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    const q = searchQuery.toLowerCase();
    return workspaces.filter((w) => {
      const telemetry = telemetries[w.id];
      const owner = telemetry?.users.find(
        (u) => u.role === WorkspaceRole.OWNER || u.role === 'OWNER',
      );
      return (
        w.name.toLowerCase().includes(q) ||
        (owner && (owner.email.toLowerCase().includes(q) || owner.name.toLowerCase().includes(q)))
      );
    });
  }, [workspaces, searchQuery, telemetries]);

  const columns = [
    {
      title: 'Tenant',
      key: 'name',
      render: (_: any, record: WorkspaceResponse) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-gray-700 dark:text-blue-400">
            <ApartmentOutlined className="text-lg" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{record.name}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: any, record: WorkspaceResponse) => {
        const telemetry = telemetries[record.id];
        const owner = telemetry?.users.find(
          (u) => u.role === WorkspaceRole.OWNER || u.role === 'OWNER',
        );
        if (!owner) {
          return <Text type="secondary" className="text-xs">No owner</Text>;
        }
        return (
          <div>
            <div className="font-medium text-gray-800 dark:text-gray-200">
              {owner.name || owner.email}
            </div>
            {owner.name && <div className="text-xs text-gray-500">{owner.email}</div>}
          </div>
        );
      },
    },
    {
      title: 'Members',
      key: 'members',
      render: (_: any, record: WorkspaceResponse) => {
        const telemetry = telemetries[record.id];
        const count = telemetry?.users.length ?? 1;
        return (
          <Tag icon={<TeamOutlined />} color="default">
            {count}
          </Tag>
        );
      },
    },
    {
      title: 'Databases',
      key: 'databases',
      render: (_: any, record: WorkspaceResponse) => {
        const telemetry = telemetries[record.id];
        const count = telemetry?.databasesCount ?? 0;
        return (
          <Tag icon={<DatabaseOutlined />} color={count > 0 ? 'blue' : 'default'}>
            {count}
          </Tag>
        );
      },
    },
    {
      title: 'Backups',
      key: 'backups',
      render: (_: any, record: WorkspaceResponse) => {
        const telemetry = telemetries[record.id];
        const count = telemetry?.backupsCount ?? 0;
        return (
          <Tag icon={<HistoryOutlined />} color={count > 0 ? 'green' : 'default'}>
            {count}
          </Tag>
        );
      },
    },
    {
      title: 'Storage Used',
      key: 'storage',
      render: (_: any, record: WorkspaceResponse) => {
        const telemetry = telemetries[record.id];
        const mb = telemetry?.storageConsumedMb ?? 0;
        return (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`}
          </span>
        );
      },
    },
    {
      title: 'Created',
      key: 'created',
      render: (_: any, record: WorkspaceResponse) => {
        if (!record.createdAt) return '-';
        return (
          <span className="text-xs text-gray-500">
            {new Date(record.createdAt).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: WorkspaceResponse) => (
        <Tooltip title="View Tenant Details">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedTenantForDetails(record)}
          >
            Details
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div
      className="flex flex-col gap-4 overflow-y-auto rounded bg-white p-4 shadow dark:bg-gray-800"
      style={{ height: contentHeight }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={4} className="!mb-0 text-gray-900 dark:text-white">
            Tenants Directory
          </Title>
          <Text type="secondary" className="text-xs">
            Manage multi-tenant organizations, view tenant quotas and resource usage.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateTenant}
            className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
          >
            Create Tenant
          </Button>
        </Space>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Input
          prefix={<SearchOutlined className="text-gray-400" />}
          placeholder="Search by tenant name, description, or owner email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          className="max-w-md"
        />
        <div className="text-xs text-gray-500">
          Total Tenants: <strong>{workspaces.length}</strong>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filteredWorkspaces}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        className="mt-2"
        size="middle"
      />

      <TenantDetailsDrawerComponent
        open={!!selectedTenantForDetails}
        workspace={selectedTenantForDetails}
        telemetry={
          selectedTenantForDetails ? telemetries[selectedTenantForDetails.id] : undefined
        }
        onClose={() => setSelectedTenantForDetails(null)}
      />
    </div>
  );
}
