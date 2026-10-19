// Mock-up data for the screens around the POC. Illustrative only: none of this is computed or wired to the agent.
// Live data (the four trucks hit by the Hume closure, relief drivers, approvals, decisions) comes from /api/state.
import type { Load } from '../core/domain';

export const CARRIER = {
  name: 'Southgate Freight',
  tag: 'Demo tenant',
  shift: 'Night shift · Fri 16 Oct',
  user: 'Night dispatcher',
};

export type Cargo = Load['cargo'];

export interface MockTruck {
  truck: string;
  driver: string;
  driverName: string;
  hoursLeft: number;
  load: string | null;
  customer: string;
  cargo: Cargo | null;
  lane: string;
  dir: 'Northbound' | 'Southbound' | '—';
  /** position on the schematic: between two map nodes, fraction 0..1 */
  seg: [string, string, number];
  where: string;
  status: string;
  tone: 'ok' | 'warn' | 'idle';
  window: string;
  eta: string;
}

export const TRUCKS: MockTruck[] = [
  { truck: 'T-05', driver: 'D-N5', driverName: 'K. Okafor', hoursLeft: 2.6, load: 'L-1029', customer: 'GreenLeaf Produce', cargo: 'perishable', lane: 'MEL → SYD', dir: 'Northbound', seg: ['GOU', 'SYD', 0.45], where: 'North of Goulburn', status: 'On schedule', tone: 'ok', window: '04:00', eta: '00:40' },
  { truck: 'T-02', driver: 'D-N2', driverName: 'H. Patel', hoursLeft: 4.1, load: 'L-1031', customer: 'Harbour Office Supplies', cargo: 'general', lane: 'MEL → SYD', dir: 'Northbound', seg: ['YAS', 'GOU', 0.3], where: 'Near Yass (passed closure point 19:50)', status: 'On schedule', tone: 'ok', window: '05:00', eta: '02:55' },
  { truck: 'T-30', driver: 'D-S3', driverName: 'L. Moreau', hoursLeft: 5.2, load: 'L-2022', customer: 'Southern Steel Co', cargo: 'general', lane: 'SYD → MEL', dir: 'Southbound', seg: ['WOD', 'WAN', 0.35], where: 'South of Wodonga (cleared Albury 21:20)', status: 'On schedule', tone: 'ok', window: '06:00', eta: '00:40' },
  { truck: 'T-11', driver: 'D-S1', driverName: 'M. Haddad', hoursLeft: 3.0, load: 'L-2014', customer: 'Bayside Electronics', cargo: 'general', lane: 'SYD → MEL', dir: 'Southbound', seg: ['WAN', 'BEN', 0.55], where: 'Between Wangaratta and Benalla', status: 'On schedule', tone: 'ok', window: '06:00', eta: '23:35' },
  { truck: 'T-23', driver: 'D-S4', driverName: 'N. Fraser', hoursLeft: 1.6, load: 'L-2019', customer: 'Riverina Pantry Foods', cargo: 'perishable', lane: 'SYD → MEL', dir: 'Southbound', seg: ['BEN', 'MEL', 0.65], where: 'Approaching Melbourne', status: 'On schedule', tone: 'ok', window: '05:00', eta: '23:10' },
  { truck: 'T-35', driver: 'D-S6', driverName: 'P. Ivanova', hoursLeft: 0.0, load: 'L-2030', customer: 'Pacific Pharma Logistics', cargo: 'general', lane: 'SYD → MEL', dir: 'Southbound', seg: ['WOD', 'WOD', 0], where: 'Wodonga hub', status: 'Driver on rest break until 23:00', tone: 'warn', window: '07:00', eta: '02:30' },
  { truck: 'T-20', driver: 'D-S8', driverName: 'Q. Lam', hoursLeft: 12, load: 'L-2027', customer: 'Harbour Office Supplies', cargo: 'general', lane: 'SYD → MEL', dir: 'Southbound', seg: ['SYD', 'SYD', 0], where: 'Sydney (Moorebank) depot', status: 'Scheduled 04:30, after estimated reopening', tone: 'idle', window: '14:00', eta: '13:10' },
  { truck: 'T-28', driver: 'D-N8', driverName: 'R. Costa', hoursLeft: 1.2, load: 'L-1025', customer: 'GreenLeaf Produce', cargo: 'perishable', lane: 'MEL → SYD', dir: '—', seg: ['SYD', 'SYD', 0], where: 'Sydney (Moorebank) depot', status: 'Delivered 21:15, unloading', tone: 'idle', window: '22:00', eta: '21:15' },
  { truck: 'T-26', driver: '—', driverName: '—', hoursLeft: 0, load: null, customer: '—', cargo: null, lane: '—', dir: '—', seg: ['MEL', 'MEL', 0], where: 'Melbourne (Somerton) depot', status: 'Maintenance: brake service', tone: 'idle', window: '—', eta: '—' },
];

export const HUBS = [
  { id: 'MEL', name: 'Melbourne (Somerton)', docks: 8, docksBusy: 3, note: 'Depot · 1 truck in maintenance' },
  { id: 'WOD', name: 'Wodonga hub', docks: 6, docksBusy: 2, note: 'Relay and rest hub, midpoint of the corridor' },
  { id: 'SYD', name: 'Sydney (Moorebank)', docks: 10, docksBusy: 4, note: 'Depot · 2 trucks on site' },
];

/** Rostered relay drivers at Wodonga (already allocated, not spare). */
export const ROSTERED = [
  { id: 'D-W3', name: 'S. Murphy', hoursLeft: 12, status: 'Rostered: relay swap 02:30 (T-41, inbound later tonight)' },
  { id: 'D-W4', name: 'T. Abara', hoursLeft: 12, status: 'Rostered: relay swap 04:10 (T-44, inbound later tonight)' },
];

export const HUB_SCHEDULE = [
  { time: '21:00', truck: 'T-35', what: 'Rest break, driver D-S6 (7h rule reached)', dock: 'Bay 4', status: 'In progress', source: 'Roster' },
  { time: '23:00', truck: 'T-35', what: 'Departs south to Melbourne', dock: 'Bay 4', status: 'Planned', source: 'Roster' },
  { time: '02:30', truck: 'T-41', what: 'Relay swap D-N9 → D-W3', dock: 'Dock 2', status: 'Planned', source: 'Dispatch plan' },
  { time: '04:10', truck: 'T-44', what: 'Relay swap D-N11 → D-W4', dock: 'Dock 3', status: 'Planned', source: 'Dispatch plan' },
];

export const HUB_SUGGESTIONS = [
  { id: 'HH-211', text: 'Hold T-41 relay swap at Dock 2 instead of Dock 1: Dock 1 is needed for tonight\'s exception swaps.', status: 'Auto-applied (policy: dock reassignment within hub)' },
  { id: 'HH-212', text: 'D-W3 and D-W4 are rostered for relays; do not use them as relief for the closure without re-rostering T-41 and T-44.', status: 'Advisory' },
];

export const DISPATCH_PLAN = {
  id: 'DP-0418',
  title: 'Tomorrow night · Sat 17 Oct',
  createdBy: 'Dispatch agent',
  createdAt: '16:40',
  status: 'Awaiting dispatcher sign-off',
  stats: [
    { k: 'Loads', v: '12' },
    { k: 'Drivers', v: '11 + 1 relief held' },
    { k: 'Freight km per driver-hour', v: '63', d: 'vs 58 four-week average' },
    { k: 'Empty km', v: '9%', d: 'vs 14% four-week average' },
  ],
  assumptions: [
    'Hume Hwy reopened by 06:00 Sat. If not, the plan is re-run at 06:00 with the Olympic Hwy detour.',
    'Fatigue rules: 12h work in 24h, 7h continuous rest (simplified for the demo).',
    'Dangerous goods only on DG-licensed drivers and permitted routes.',
  ],
  rows: [
    { load: 'L-1071', lane: 'MEL → SYD', cargo: 'perishable' as Cargo, window: '06:00', truck: 'T-23', driver: 'D-S4 → D-W1 at Wodonga', depart: '20:30', eta: '05:10', checks: ['Hours', 'Window'], note: 'Relay at Wodonga keeps both drivers inside hours.' },
    { load: 'L-1072', lane: 'MEL → SYD', cargo: 'dangerous_goods' as Cargo, window: '10:00', truck: 'T-30', driver: 'D-S3 (DG licence)', depart: '23:00', eta: '09:20', checks: ['Hours', 'DG licence', 'DG route'], note: 'Hume only: the Olympic Hwy DG restriction may persist.' },
    { load: 'L-1073', lane: 'MEL → SYD', cargo: 'general' as Cargo, window: '06:00', truck: 'T-11', driver: 'D-S1 → D-W2 at Wodonga', depart: '20:45', eta: '05:25', checks: ['Hours', 'Window'], note: '' },
    { load: 'L-1074', lane: 'MEL → SYD', cargo: 'general' as Cargo, window: '14:00', truck: 'T-35', driver: 'D-S6', depart: '02:00', eta: '11:40', checks: ['Hours', 'Window'], note: 'Late departure frees a 06:00 dock slot at Moorebank.' },
    { load: 'L-2041', lane: 'SYD → MEL', cargo: 'general' as Cargo, window: '07:00', truck: 'T-14', driver: 'D-A1', depart: '21:00', eta: '06:15', checks: ['Hours', 'Window'], note: 'Backhaul for T-14 after tonight\'s delivery, avoids an empty return.' },
    { load: 'L-2042', lane: 'SYD → MEL', cargo: 'perishable' as Cargo, window: '05:00', truck: 'T-05', driver: 'D-N5 → D-W3 at Wodonga', depart: '19:30', eta: '04:20', checks: ['Hours', 'Window'], note: '' },
    { load: 'L-2043', lane: 'SYD → MEL', cargo: 'general' as Cargo, window: '12:00', truck: 'T-21', driver: 'D-A3', depart: '01:30', eta: '10:45', checks: ['Hours', 'Window'], note: '' },
    { load: 'L-2044', lane: 'SYD → MEL', cargo: 'general' as Cargo, window: '09:00', truck: 'T-02', driver: 'D-N2', depart: '23:30', eta: '08:30', checks: ['Hours', 'Window'], note: 'Only 30 min slack: flagged for the exception agent to watch.' },
  ],
  questions: [
    'L-1071 and L-1073 both reach Moorebank around 05:10–05:25 for 06:00 windows. Dock capacity for two arrivals is unconfirmed.',
    'T-26 is in maintenance. Plan assumes it is not available tomorrow.',
  ],
};

export const POLICIES = [
  { action: 'Hold a truck in place or at a hub', rule: 'Auto if the closure estimate is 6h or less and the load stays on time; otherwise needs approval', agent: 'Exception' },
  { action: 'Reroute with the same driver', rule: 'Auto if within driver hours and cargo is permitted on the route; dangerous goods on a restricted route are blocked', agent: 'Exception' },
  { action: 'Reassign a driver during an exception (relief or swap)', rule: 'Always needs dispatcher approval', agent: 'Exception' },
  { action: 'Match an arriving truck to a hub driver', rule: 'Auto within compliance rules; escalate when no compliant driver is available', agent: 'Hub handover' },
  { action: 'Any action that breaks fatigue rules', rule: 'Blocked', agent: 'All' },
  { action: 'Shipper and hub notification', rule: 'Drafted by the agent; a person sends it (MVP), automatic once policy allows', agent: 'Exception' },
  { action: 'Dock reassignment within a hub', rule: 'Auto', agent: 'Hub handover' },
  { action: 'Nightly dispatch plan', rule: 'Needs dispatcher sign-off', agent: 'Dispatch' },
  { action: 'In-shift booking of a standard load', rule: 'Auto within policy; dangerous goods, high-value and below-margin loads need approval', agent: 'Dispatch' },
];

export const AGENT_ACTIVITY = [
  { time: '16:40', agent: 'Dispatch', text: 'Drafted tomorrow night\'s plan DP-0418: 12 loads, 63 freight km per driver-hour.' },
  { time: '20:55', agent: 'Hub handover', text: 'T-35 driver reached the 7h limit; scheduled a rest break at Wodonga until 23:00.' },
  { time: '21:12', agent: 'Hub handover', text: 'Moved T-41 relay swap to Dock 2 (auto, within policy).' },
];

export const EARLIER_DECISIONS = [
  { when: 'Thu 15 Oct 23:18', text: 'L-0987: reroute via Olympic Hwy after a truck fire near Holbrook · ETA 05:40 · auto (policy)' },
  { when: 'Thu 15 Oct 23:20', text: 'L-0991: driver swap at Wodonga with D-W1 · approved by dispatcher' },
  { when: 'Thu 15 Oct 16:35', text: 'DP-0417 dispatch plan signed off by dispatcher (2 edits)' },
  { when: 'Wed 14 Oct 02:05', text: 'L-0952: hold at Wodonga 40 min for dock congestion at Moorebank · auto (policy)' },
];
