import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { RolesGuard } from './roles.guard';

function contextWithRole(role?: WorkspaceRole): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ workspaceRole: role }) }),
    getHandler: () => null,
    getClass: () => null,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guardFor = (required?: WorkspaceRole[]) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('allows when no roles are required', () => {
    expect(guardFor(undefined).canActivate(contextWithRole(WorkspaceRole.MEMBER))).toBe(true);
  });

  it('allows when the caller role is permitted', () => {
    expect(
      guardFor([WorkspaceRole.ADMIN]).canActivate(contextWithRole(WorkspaceRole.ADMIN)),
    ).toBe(true);
  });

  it('forbids when the caller role is insufficient', () => {
    expect(() =>
      guardFor([WorkspaceRole.ADMIN]).canActivate(contextWithRole(WorkspaceRole.MEMBER)),
    ).toThrow(ForbiddenException);
  });

  it('forbids when no role is present', () => {
    expect(() =>
      guardFor([WorkspaceRole.ADMIN]).canActivate(contextWithRole(undefined)),
    ).toThrow(ForbiddenException);
  });
});
