/**
 * Hume Highway flooding scenario: seed data. All simulated.
 * Times are minutes from 00:00 on day 1 of the shift (21:40 = 1300).
 */
import type { Driver, Hub, Load, Network, Report } from '../../core/domain';
import { hm, NEXT_DAY } from '../../core/time';

export const START_MIN = hm(21, 40);

/** Drive hours on the corridor tonight; dangerous goods are banned from the Olympic detour. */
export const network = (): Network => ({
  humeFromHubH: 5.2,
  olympicFromHubH: 6.9,
  humeFromClosureH: 4.8,
  swapH: 0.25,
  olympicBannedCargo: ['dangerous_goods'],
});

export const hubs = (): Hub[] => [
  { id: 'MEL', name: 'Melbourne (Somerton)' },
  { id: 'WOD', name: 'Wodonga hub' },
  { id: 'SYD', name: 'Sydney (Moorebank)' },
];

export const drivers = (): Driver[] => [
  { id: 'D-A1', name: 'A. Nguyen', hub: null, hoursLeft: 2.0, available: false },
  { id: 'D-A2', name: 'B. Kelly', hub: null, hoursLeft: 3.5, available: false },
  { id: 'D-A3', name: 'C. Rossi', hub: null, hoursLeft: 6.0, available: false },
  { id: 'D-A4', name: 'D. Walsh', hub: null, hoursLeft: 4.0, available: false },
  { id: 'D-W1', name: 'E. Singh', hub: 'WOD', hoursLeft: 12, available: true },
  { id: 'D-W2', name: 'F. Brown', hub: 'WOD', hoursLeft: 12, available: true },
  { id: 'D-M3', name: 'G. Taylor', hub: 'MEL', hoursLeft: 12, available: true, travelToWodongaH: 3.5 },
];

const load = (l: Omit<Load, 'status' | 'etaMin' | 'assignedDriverId' | 'plan'>): Load => ({
  ...l,
  status: 'In transit',
  etaMin: null,
  assignedDriverId: l.driverId,
  plan: null,
});

export const loads = (): Load[] => [
  load({
    id: 'L-1042', customer: 'FreshCo DC Sydney', cargo: 'perishable', description: 'Chilled produce, 22 pallets',
    truckId: 'T-14', driverId: 'D-A1', windowMin: NEXT_DAY + hm(6), lateCostAud: 9000,
    lateCostNote: 'Product written off after 06:00', posFromWodongaH: 0.4, stoppedAtClosure: true,
  }),
  load({
    id: 'L-1038', customer: 'Northline Retail', cargo: 'general', description: 'Retail replenishment, 24 pallets',
    truckId: 'T-09', driverId: 'D-A2', windowMin: NEXT_DAY + hm(6), lateCostAud: 2500,
    lateCostNote: 'Late-delivery penalty after 06:00', posFromWodongaH: 0.1, stoppedAtClosure: false,
  }),
  load({
    id: 'L-1051', customer: 'PetroSupply', cargo: 'dangerous_goods', description: 'Class 3 flammable liquids',
    truckId: 'T-21', driverId: 'D-A3', windowMin: NEXT_DAY + hm(10), lateCostAud: 1500,
    lateCostNote: 'Site rebooking fee after 10:00', posFromWodongaH: 0, stoppedAtClosure: false,
  }),
  load({
    id: 'L-1060', customer: 'Coastal Hardware', cargo: 'general', description: 'Building supplies, 18 pallets',
    truckId: 'T-33', driverId: 'D-A4', windowMin: NEXT_DAY + hm(14), lateCostAud: 0,
    lateCostNote: 'Flexible window', posFromWodongaH: -0.2, stoppedAtClosure: false,
  }),
];

export const reports = (): Report[] => [
  { id: 'R1', source: 'Road authority alert', timeMin: hm(21, 38),
    text: 'Hume Hwy closed both directions north of Albury due to floodwater over the road. Closed until further notice. Use alternative routes.' },
  { id: 'R2', source: 'Driver message (D-A1, truck T-14)', timeMin: hm(21, 41),
    text: 'stopped at the closure, water over the road. police reckon maybe 3-4 hrs, SES on site' },
  { id: 'R3', source: 'Weather service', timeMin: hm(21, 35),
    text: 'Heavy rain easing after midnight. Creek levels near Albury expected to peak around 02:00.' },
  { id: 'R4', source: 'Road authority advisory', timeMin: hm(21, 30),
    text: 'Olympic Hwy open. Restricted: dangerous goods vehicles not permitted on the Wagga detour segment tonight.' },
];

