export type { NotificationTapAction } from '../constants/notifications';

export type NotificationPayload = {
  order_id?: string;
  source?: string;
  store_id?: string;
  deep_link?: string;
};
