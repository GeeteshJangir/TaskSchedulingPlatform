/**
 * In-process domain events emitted by TasksService. Consumers (activity log in
 * Phase 5, notifications in Phase 6) subscribe via @OnEvent — TasksService stays
 * unaware of side-effects (open/closed principle).
 */
export const TASK_CREATED = 'task.created';
export const TASK_ASSIGNED = 'task.assigned';
export const TASK_STATUS_CHANGED = 'task.status_changed';
export const TASK_COMPLETED = 'task.completed';

export interface TaskCreatedEvent {
  taskId: string;
  projectId: string;
  actorId: string;
}

export interface TaskAssignedEvent {
  taskId: string;
  assigneeId: string;
  actorId: string;
}

export interface TaskStatusChangedEvent {
  taskId: string;
  from: string;
  to: string;
  actorId: string;
}

export interface TaskCompletedEvent {
  taskId: string;
  actorId: string;
}
