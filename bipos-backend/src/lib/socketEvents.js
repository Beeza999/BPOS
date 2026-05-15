export function branchRoom(branchId) {
  return `branch:${branchId}`;
}

export function restaurantRoom(restaurantId) {
  return `restaurant:${restaurantId}`;
}

export function tableRoom(tableId) {
  return `table:${tableId}`;
}

export function emitRestaurant(req, restaurantId, event, payload) {
  if (restaurantId) req.io?.to(restaurantRoom(restaurantId)).emit(event, payload);
}

export function emitBranch(req, branchId, event, payload) {
  if (branchId) req.io?.to(branchRoom(branchId)).emit(event, payload);
}

export function emitBranchAndRestaurant(req, { branchId, restaurantId }, event, payload) {
  emitBranch(req, branchId, event, payload);
  emitRestaurant(req, restaurantId, event, payload);
}

export function emitTable(req, tableId, event, payload) {
  if (tableId) req.io?.to(tableRoom(tableId)).emit(event, payload);
}
