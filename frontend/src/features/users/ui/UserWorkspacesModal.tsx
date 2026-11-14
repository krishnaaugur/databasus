/* eslint-disable i18next/no-literal-string -- workspace member management UI */
import {
  ApartmentOutlined,
  DeleteOutlined,
  LoadingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';

import {
  type UserProfile,
  WorkspaceRole,
} from '../../../entity/users';
import {
  type WorkspaceResponse,
  workspaceApi,
  workspaceMembershipApi,
} from '../../../entity/workspaces';

interface Props {
  user: UserProfile | null;
  open: boolean;
  onClose: () => void;
}

interface WorkspaceAssignmentRow {
  workspaceId: string;
  workspaceName: string;
  isMember: boolean;
  role?: WorkspaceRole;
}


export function UserWorkspacesModal({ user, open, onClose }: Props) {
  const { message } = App.useApp();
  const [workspaces, setWorkspaces] = useState<WorkspaceAssignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadAssignments = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const list = await workspaceApi.getWorkspaces();
      const allWorkspaces: WorkspaceResponse[] = list.workspaces || [];

      // Fetch membership status for each workspace
      const rows: WorkspaceAssignmentRow[] = await Promise.all(
        allWorkspaces.map(async (ws) => {
          try {
            const membersRes = await workspaceMembershipApi.getMembers(ws.id);
            const userMember = (membersRes.members || []).find((m) => m.userId === user.id);
            return {
              workspaceId: ws.id,
              workspaceName: ws.name,
              isMember: Boolean(userMember),
              role: userMember?.role,
            };
          } catch {
            return {
              workspaceId: ws.id,
              workspaceName: ws.name,
              isMember: false,
            };
          }
        }),
      );

      setWorkspaces(rows);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      loadAssignments();
    }
  }, [open, user]);

  const handleAddMember = async (workspaceId: string, role: WorkspaceRole) => {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [workspaceId]: true }));
    try {
      await workspaceMembershipApi.addMember(workspaceId, {
        email: user.email,
        role,
      });
      message.success(`Added to workspace`);
      await loadAssignments();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to add user to workspace');
    } finally {
      setActionLoading((prev) => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handleChangeRole = async (workspaceId: string, newRole: WorkspaceRole) => {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [workspaceId]: true }));
    try {
      await workspaceMembershipApi.changeMemberRole(workspaceId, user.id, { role: newRole });
      message.success('Workspace role updated');
      await loadAssignments();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setActionLoading((prev) => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handleRemoveMember = async (workspaceId: string) => {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [workspaceId]: true }));
    try {
      await workspaceMembershipApi.removeMember(workspaceId, user.id);
      message.success('Removed from workspace');
      await loadAssignments();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to remove user from workspace');
    } finally {
      setActionLoading((prev) => ({ ...prev, [workspaceId]: false }));
    }
  };

  const columns: ColumnsType<WorkspaceAssignmentRow> = [
    {
      title: 'Workspace',
      dataIndex: 'workspaceName',
      key: 'workspaceName',
      render: (name: string) => (
        <div className="flex items-center space-x-2 font-medium text-gray-900 dark:text-white">
          <ApartmentOutlined className="text-blue-500" />
          <span>{name}</span>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) =>
        r.isMember ? (
          <Tag color="green">Member</Tag>
        ) : (
          <Tag color="default">Not a Member</Tag>
        ),
    },
    {
      title: 'Workspace Role',
      key: 'role',
      render: (_, r) => {
        if (!r.isMember) return <span className="text-xs text-gray-400">—</span>;
        return (
          <Select
            value={r.role}
            size="small"
            className="w-36"
            loading={actionLoading[r.workspaceId]}
            disabled={actionLoading[r.workspaceId] || r.role === WorkspaceRole.OWNER}
            onChange={(newRole) => handleChangeRole(r.workspaceId, newRole)}
          >
            <Select.Option value={WorkspaceRole.ADMIN}>Admin</Select.Option>
            <Select.Option value={WorkspaceRole.MEMBER}>Member</Select.Option>
            <Select.Option value={WorkspaceRole.VIEWER}>Viewer</Select.Option>
          </Select>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => {
        if (r.isMember) {
          if (r.role === WorkspaceRole.OWNER) {
            return <span className="text-xs text-purple-600 font-medium">Owner</span>;
          }
          return (
            <Popconfirm
              title="Remove from Workspace"
              description={`Revoke access to ${r.workspaceName}?`}
              onConfirm={() => handleRemoveMember(r.workspaceId)}
              okText="Remove"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={actionLoading[r.workspaceId]}
              >
                Remove
              </Button>
            </Popconfirm>
          );
        }

        return (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            loading={actionLoading[r.workspaceId]}
            onClick={() => handleAddMember(r.workspaceId, WorkspaceRole.MEMBER)}
          >
            Grant Access
          </Button>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <ApartmentOutlined className="text-blue-600" />
          <span>Workspace Access: {user?.name || user?.email}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>,
      ]}
      width={680}
      destroyOnClose
    >
      <div className="space-y-4 pt-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Assign which workspaces <strong>{user?.email}</strong> can access and choose their role
          in each workspace.
        </p>

        {isLoading ? (
          <div className="py-6 text-center">
            <Spin indicator={<LoadingOutlined spin />} />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={workspaces}
            rowKey="workspaceId"
            pagination={false}
            size="small"
            locale={{ emptyText: 'No workspaces created yet' }}
          />
        )}
      </div>
    </Modal>
  );
}

