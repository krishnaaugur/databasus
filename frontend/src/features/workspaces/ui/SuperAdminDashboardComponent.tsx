/* eslint-disable i18next/no-literal-string -- Super Admin Dashboard UI */
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  DatabaseOutlined,
  HddOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

import type { DiskUsage } from '../../../entity/disk';
import { type UserProfile, WorkspaceRole } from '../../../entity/users';
import {
  type WorkspaceResponse,
  type WorkspaceTelemetry,
  workspaceApi,
} from '../../../entity/workspaces';
import { TenantDetailsDrawerComponent } from './TenantDetailsDrawerComponent';

const { Title, Text } = Typography;

interface Props {
  workspaces: WorkspaceResponse[];
  user?: UserProfile;
  diskUsage?: DiskUsage;
  contentHeight: number;
  onCreateTenant: () => void;
  onNavigateToTab: (tab: string) => void;
  onRefreshWorkspaces: () => Promise<void>;
}

export function SuperAdminDashboardComponent({
  workspaces,
  user: _user,
  diskUsage: _diskUsage,
  contentHeight,
  onCreateTenant,
  onNavigateToTab,
  onRefreshWorkspaces,
}: Props) {
  const { message } = App.useApp();
  const [telemetries, setTelemetries] = useState<Record<string, WorkspaceTelemetry>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTenantForDetails, setSelectedTenantForDetails] =
    useState<WorkspaceResponse | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await workspaceApi.getAllWorkspacesTelemetry();
      const telemetryMap: Record<string, WorkspaceTelemetry> = {};
      data.forEach((item) => {
        telemetryMap[item.workspaceId] = item;
      });
      setTelemetries(telemetryMap);
    } catch {
      // Telemetry might fail if unauthorized, non-fatal
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaces]);

  const handleRefresh = async () => {
    await Promise.all([onRefreshWorkspaces(), loadData()]);
    message.success('Platform stats refreshed');
  };

  // Aggregate stats across all tenants
  const aggregateStats = useMemo(() => {
    let totalDatabases = 0;
    let totalBackups = 0;
    let totalStorageMb = 0;
    const uniqueUserIds = new Set<string>();

    Object.values(telemetries).forEach((telemetry) => {
      totalDatabases += telemetry.databasesCount || 0;
      totalBackups += telemetry.backupsCount || 0;
      totalStorageMb += telemetry.storageConsumedMb || 0;
      telemetry.users?.forEach((u) => uniqueUserIds.add(u.id));
    });

    return {
      totalTenants: workspaces.length,
      totalDatabases,
      totalBackups,
      totalStorageMb,
      totalUsers: uniqueUserIds.size,
    };
  }, [workspaces, telemetries]);

  const topTenants = useMemo(() => {
    return [...workspaces]
      .sort((a, b) => {
        const dbsA = telemetries[a.id]?.databasesCount || 0;
        const dbsB = telemetries[b.id]?.databasesCount || 0;
        return dbsB - dbsA;
      })
      .slice(0, 5);
  }, [workspaces, telemetries]);

  const recentColumns = [
    {
      title: 'Tenant',
      key: 'name',
      render: (_: any, record: WorkspaceResponse) => (
        <div className="font-semibold text-gray-900 dark:text-gray-100">{record.name}</div>
      ),
    },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: any, record: WorkspaceResponse) => {
        const owner = telemetries[record.id]?.users.find(
          (u) => u.role === WorkspaceRole.OWNER || u.role === 'OWNER',
        );
        return (
          <div className="text-xs">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {owner?.name || owner?.email || 'Unassigned'}
            </span>
            {owner && owner.name && <span className="block text-gray-500">{owner.email}</span>}
          </div>
        );
      },
    },
    {
      title: 'Databases',
      key: 'databases',
      render: (_: any, record: WorkspaceResponse) => (
        <Tag color="blue">{telemetries[record.id]?.databasesCount ?? 0}</Tag>
      ),
    },
    {
      title: 'Backups',
      key: 'backups',
      render: (_: any, record: WorkspaceResponse) => (
        <Tag color="green">{telemetries[record.id]?.backupsCount ?? 0}</Tag>
      ),
    },
    {
      title: 'Storage',
      key: 'storage',
      render: (_: any, record: WorkspaceResponse) => {
        const mb = telemetries[record.id]?.storageConsumedMb ?? 0;
        return (
          <span className="text-xs">
            {mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`}
          </span>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: WorkspaceResponse) => (
        <Button
          size="small"
          onClick={() => setSelectedTenantForDetails(record)}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div
      className="flex flex-col gap-5 overflow-y-auto rounded bg-white p-5 shadow dark:bg-gray-800"
      style={{ height: contentHeight }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
        <div>
          <Title level={4} className="!mb-0 text-gray-900 dark:text-white">
            Super Admin Platform Dashboard
          </Title>
          <Text type="secondary" className="text-xs">
            Multi-tenant system monitoring, quota utilization, and infrastructure status.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading}>
            Refresh Stats
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

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" className="border-l-4 border-l-blue-500 shadow-sm">
            <Statistic
              title={
                <span className="text-xs font-semibold text-gray-500">TOTAL TENANTS</span>
              }
              value={aggregateStats.totalTenants}
              prefix={<ApartmentOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card size="small" className="border-l-4 border-l-indigo-500 shadow-sm">
            <Statistic
              title={
                <span className="text-xs font-semibold text-gray-500">MANAGED DATABASES</span>
              }
              value={aggregateStats.totalDatabases}
              prefix={<DatabaseOutlined className="text-indigo-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card size="small" className="border-l-4 border-l-emerald-500 shadow-sm">
            <Statistic
              title={
                <span className="text-xs font-semibold text-gray-500">TOTAL BACKUPS</span>
              }
              value={aggregateStats.totalBackups}
              prefix={<HistoryOutlined className="text-emerald-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card size="small" className="border-l-4 border-l-purple-500 shadow-sm">
            <Statistic
              title={
                <span className="text-xs font-semibold text-gray-500">TENANT STORAGE</span>
              }
              value={
                aggregateStats.totalStorageMb > 1024
                  ? `${(aggregateStats.totalStorageMb / 1024).toFixed(2)} GB`
                  : `${aggregateStats.totalStorageMb.toFixed(1)} MB`
              }
              prefix={<HddOutlined className="text-purple-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card size="small" className="border-l-4 border-l-orange-500 shadow-sm">
            <Statistic
              title={
                <span className="text-xs font-semibold text-gray-500">TENANT USERS</span>
              }
              value={aggregateStats.totalUsers}
              prefix={<TeamOutlined className="text-orange-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Security & Quick Actions Banner */}
      <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-900 dark:from-gray-800 dark:to-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex orientation-left items-center gap-2">
              <SafetyCertificateOutlined className="text-lg text-blue-600" />
              <span className="font-semibold text-blue-950 dark:text-blue-200">
                Zero-Knowledge Tenant Isolation Active
              </span>
            </div>
            <p className="mt-1 text-xs text-blue-900/80 dark:text-blue-300/70">
              Tenant database connection secrets and backup archives remain end-to-end encrypted with workspace keys. Super administrators cannot view credentials or run ad-hoc restores on tenant resources.
            </p>
          </div>
          <Space wrap>
            <Button
              icon={<ApartmentOutlined />}
              onClick={() => onNavigateToTab('tenants')}
            >
              View All Tenants
            </Button>
            <Button
              icon={<UserOutlined />}
              onClick={() => onNavigateToTab('users')}
            >
              Users & Permissions
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => onNavigateToTab('databasus-settings')}
            >
              System Settings
            </Button>
          </Space>
        </div>
      </div>

      {/* Top Tenants Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Title level={5} className="!mb-0 text-gray-800 dark:text-gray-200">
            Top Active Tenants
          </Title>
          <Button
            type="link"
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={() => onNavigateToTab('tenants')}
          >
            See all {workspaces.length} tenants
          </Button>
        </div>
        <Table
          columns={recentColumns}
          dataSource={topTenants}
          rowKey="id"
          pagination={false}
          size="small"
          loading={isLoading}
        />
      </div>

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
