import type { GameState } from './types';

export const resolveDueShipments = (
  state: GameState,
  sealedProductCapacity: number,
  createInstanceId: () => string = () => crypto.randomUUID(),
): GameState => {
  if (!Number.isInteger(sealedProductCapacity) || sealedProductCapacity < 0) {
    throw new Error('Sealed-product capacity must be a non-negative integer.');
  }
  if (state.shipments.length === 0) return state;

  let changed = false;
  const sealed = [...state.sealed];
  const shipments = state.shipments.map(shipment => {
    if (shipment.status === 'delivered' || shipment.arrivalTime > state.clockMinutes) return shipment;

    const destinationIsOwned = state.ownedLocations.includes(shipment.destinationLocationId);
    const itemCount = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
    const occupied = sealed.filter(item => item.locationId === shipment.destinationLocationId).length;
    if (!destinationIsOwned || occupied + itemCount > sealedProductCapacity) {
      if (shipment.status === 'awaiting-capacity') return shipment;
      changed = true;
      return { ...shipment, status: 'awaiting-capacity' as const };
    }

    for (const item of shipment.items) {
      for (let index = 0; index < item.quantity; index += 1) {
        sealed.push({
          id: createInstanceId(),
          type: item.type,
          setId: item.setId,
          productId: item.productId,
          locationId: shipment.destinationLocationId,
        });
      }
    }
    changed = true;
    return { ...shipment, status: 'delivered' as const };
  });

  return changed ? { ...state, sealed, shipments } : state;
};
