import React, { useState } from 'react';
import { ScreenHome } from './home';
import { ScreenSealed } from './sealed';
import { ScreenStorage } from './storage';
import { useGame } from '../game/state';
import { gameDayForClock, gameTimeOfDay } from '../game/time';

type InventoryTab = 'overview' | 'sealed' | 'storage';

export const ScreenInventory = ({ onRipPack }: { onRipPack: (id: string, setId: string, productId?: string) => void }) => {
  const { state, setState } = useGame();
  const [tab, setTab] = useState<InventoryTab>('overview');
  const tabs: { id: InventoryTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'sealed', label: 'Sealed' },
    { id: 'storage', label: 'Storage' },
  ];

  return (
    <div>
      <div className="flex gap-2 bg-slate-950 px-4 py-2">
        {tabs.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${tab === item.id ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {item.label}
          </button>
        ))}
      </div>
      {state.shipments.length > 0 && (
        <section className="mx-4 mb-2 bg-slate-900 rounded-xl border border-slate-800 p-3">
          <h3 className="font-bold text-white text-sm mb-2">Online Shipments</h3>
          <div className="space-y-2">
            {state.shipments.map(shipment => {
              const arrival = gameTimeOfDay(shipment.arrivalTime);
              return (
                <div key={shipment.id} className="bg-slate-800 rounded p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-200">
                    {shipment.vendorId} · {shipment.items.reduce((sum, item) => sum + item.quantity, 0)} item(s) · {shipment.status}
                    {shipment.status !== 'delivered' && ` · Day ${gameDayForClock(shipment.arrivalTime)} ${String(arrival.hour).padStart(2, '0')}:${String(arrival.minute).padStart(2, '0')}`}
                  </span>
                  {shipment.status === 'awaiting-capacity' && (
                    <label className="text-slate-300">Receiving location
                      <select value={shipment.destinationLocationId} onChange={event => setState(prev => ({
                        ...prev,
                        shipments: prev.shipments.map(item => item.id === shipment.id ? { ...item, destinationLocationId: event.target.value } : item),
                      }))} className="ml-2 bg-slate-900 rounded px-2 py-1">
                        {state.ownedLocations.map(locationId => <option key={locationId} value={locationId}>{locationId}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {tab === 'overview' && <ScreenHome />}
      {tab === 'sealed' && <ScreenSealed onRipPack={onRipPack} />}
      {tab === 'storage' && <ScreenStorage />}
    </div>
  );
};
