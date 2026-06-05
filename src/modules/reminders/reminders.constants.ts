export const REMINDERS_QUEUE = 'reminders';
export const SEND_REMINDER_JOB = 'send-reminder';

export interface SendReminderJob {
  reminderId: string;
}
