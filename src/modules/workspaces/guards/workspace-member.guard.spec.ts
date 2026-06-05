import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspacesService } from '../workspaces.service';
import { WorkspaceMemberGuard } from './workspace-member.guard';

function context(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('WorkspaceMemberGuard', () => {
  let guard: WorkspaceMemberGuard;
  let workspaces: jest.Mocked<Pick<WorkspacesService, 'getMembership'>>;

  beforeEach(() => {
    workspaces = { getMembership: jest.fn() } as never;
    guard = new WorkspaceMemberGuard(
      workspaces as unknown as WorkspacesService,
    );
  });

  it('rejects when workspaceId is absent', async () => {
    const req = { user: { userId: 'u1' }, params: {}, body: {} };
    await expect(guard.canActivate(context(req))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects non-members', async () => {
    workspaces.getMembership.mockResolvedValue(null);
    const req = { user: { userId: 'u1' }, params: { workspaceId: 'w1' } };
    await expect(guard.canActivate(context(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches role and allows members', async () => {
    workspaces.getMembership.mockResolvedValue({
      role: WorkspaceRole.ADMIN,
    } as never);
    const req: Record<string, unknown> = {
      user: { userId: 'u1' },
      params: { workspaceId: 'w1' },
    };
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(req.workspaceRole).toBe(WorkspaceRole.ADMIN);
  });
});
