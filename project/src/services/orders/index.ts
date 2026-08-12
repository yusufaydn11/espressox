export {
  fetchOrdersByUserId,
  fetchOrderByNumber,
  createOrder,
  fetchStoreOrders,
  updateOrderStatusByNumber,
  fetchRecentOrdersForAdmin,
  fetchOrderStatsRows,
  updateOrderByNumber,
  deleteOrderByNumber,
} from './orderService';

export type {
  OrderWithItems,
  StoreOrderRow,
  CreateOrderItem,
  CreateOrderParams,
  CreateOrderResult,
} from './orderService';
