import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../tasks/entities/task.entity';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Reminder } from './entities/reminder.entity';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  let service: RemindersService;
  let reminderRepo: any;
  let taskRepo: any;
  let notifications: { create: jest.Mock };
  let insertResultId: string | undefined;

  function taskQb(rows: Task[]) {
    const qb: any = {
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      getMany: jest.fn(async () => rows),
    };
    return qb;
  }

  beforeEach(async () => {
    insertResultId = 'r1';
    // reminders repo: createQueryBuilder().insert()...execute() returns raw[0].id
    const insertQb: any = {
      insert: jest.fn(() => insertQb),
      into: jest.fn(() => insertQb),
      values: jest.fn(() => insertQb),
      orIgnore: jest.fn(() => insertQb),
      returning: jest.fn(() => insertQb),
      execute: jest.fn(async () => ({
        raw: insertResultId ? [{ id: insertResultId }] : [],
      })),
    };
    reminderRepo = {
      createQueryBuilder: jest.fn(() => insertQb),
      update: jest.fn(),
    };
    taskRepo = { createQueryBuilder: jest.fn() };
    notifications = { create: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: getRepositoryToken(Reminder), useValue: reminderRepo },
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(RemindersService);
  });

  it('creates a reminder + notification for a due-soon assigned task, then marks SENT', async () => {
    const task = { id: 't1', dueDate: new Date(), assigneeId: 'u1' } as Task;
    // first call (due-soon query) returns the task; second (overdue) returns none
    taskRepo.createQueryBuilder
      .mockReturnValueOnce(taskQb([task]))
      .mockReturnValueOnce(taskQb([]));

    const result = await service.scan(new Date());

    expect(result.created).toBe(1);
    expect(result.delivered).toBe(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u1',
        type: NotificationType.TASK_DUE_SOON,
      }),
    );
    expect(reminderRepo.update).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ status: 'SENT' }),
    );
  });

  it('is idempotent: an existing reminder (conflict) is not re-delivered', async () => {
    insertResultId = undefined; // orIgnore conflict -> no row returned
    const task = { id: 't1', dueDate: new Date(), assigneeId: 'u1' } as Task;
    taskRepo.createQueryBuilder
      .mockReturnValueOnce(taskQb([task]))
      .mockReturnValueOnce(taskQb([]));

    const result = await service.scan(new Date());

    expect(result.created).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
    expect(reminderRepo.update).not.toHaveBeenCalled();
  });

  it('creates an OVERDUE reminder for a past-due task', async () => {
    const task = { id: 't2', dueDate: new Date(Date.now() - 1000), assigneeId: 'u2' } as Task;
    taskRepo.createQueryBuilder
      .mockReturnValueOnce(taskQb([])) // due-soon: none
      .mockReturnValueOnce(taskQb([task])); // overdue: one

    const result = await service.scan(new Date());

    expect(result.created).toBe(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.TASK_OVERDUE }),
    );
  });
});
