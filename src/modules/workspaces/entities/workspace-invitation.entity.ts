import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { InvitationStatus } from '../enums/invitation-status.enum';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { Workspace } from './workspace.entity';

@Entity('workspace_invitations')
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @Column({ type: 'citext' })
  email: string;

  @Column({
    type: 'enum',
    enum: WorkspaceRole,
    enumName: 'workspace_member_role',
    default: WorkspaceRole.MEMBER,
  })
  role: WorkspaceRole;

  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    enumName: 'invitation_status',
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ name: 'invited_by', type: 'uuid' })
  invitedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by' })
  inviter?: User;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
