import { describe, expect, it } from 'vitest';
import { Notification } from '../index.js';

describe('Notification', () => {
  it('creates local notification events and can be marked read', () => {
    const notification = Notification.create({
      id: 'ntf_1',
      type: 'message.received',
      title: 'New message',
      channels: ['in_app', 'local_sse'],
      createdAt: new Date()
    }, 'evt_1');

    expect(notification.pullDomainEvents()[0]?.name).toBe('NotificationCreated');
    notification.markRead(new Date());
    expect(notification.isRead()).toBe(true);
  });
});
