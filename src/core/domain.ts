/**
 * Domain model shared by every agent, tool, policy and screen.
 * Times are minutes from 00:00 on day 1 of the shift (24:00 = 1440).
 */
export type CargoClass = 'perishable' | 'general' | 'dangerous_goods';

export interface Hub {
  id: string;
  name: string;
}

export interface Driver {
  id: string;
  name: string;
  hub: string | null; // null = currently driving a truck
  hoursLeft: number; // work hours left before mandatory rest (simplified fatigue rule)
  available: boolean;
  travelToWodongaH?: number; // for relief drivers based at other hubs
}

export interface Load {
  id: string;
  customer: string;
  cargo: CargoClass;
  description: string;
  truckId: string;
  driverId: string;
  windowMin: number; // delivery deadline, sim minutes
  lateCostAud: number; // cost if delivered after the window
  lateCostNote: string;
  posFromWodongaH: number; // drive hours from Wodonga hub (+ = north of hub, toward closure)
  stoppedAtClosure: boolean;
  status: string;
  etaMin: number | null;
  assignedDriverId: string;
  plan: string | null;
  action?: ActionType; // executed recovery action, used by the map and timeline
}

export interface Report {
  id: string;
  source: string;
  timeMin: number;
  text: string;
}

export type TraceKind = 'context' | 'thinking' | 'tool_call' | 'tool_result' | 'plan' | 'policy' | 'error';

export interface TraceEntry {
  id: number;
  run: string;
  kind: TraceKind;
  title: string;
  body: string;
  at: number; // wall-clock ms
}

export interface FeedEntry {
  id: number;
  timeMin: number;
  level: 'info' | 'alert' | 'ok';
  text: string;
}

export type ActionType =
  | 'hold_in_place'
  | 'reroute_olympic'
  | 'swap_driver_olympic'
  | 'swap_driver_hume'
  | 'rest_at_hub_then_hume';

export interface PlanItem {
  load_id: string;
  action: ActionType;
  relief_driver_id?: string;
}

export interface EvaluatedItem extends PlanItem {
  feasible: boolean;
  reason: string;
  etaMin: number | null;
  onTime: boolean;
  expectedCostAud: number;
  policy: 'auto' | 'approve' | 'blocked';
  policyRule: string;
}

export interface Approval {
  id: string;
  run: string;
  createdMin: number;
  rationale: string;
  closureEstimate: { reopenHours: number; confidence: string };
  items: EvaluatedItem[];
  status: 'pending' | 'approved' | 'rejected';
}

export interface Notification {
  id: number;
  timeMin: number;
  to: string;
  loadId: string;
  message: string;
}

export interface DecisionRecord {
  id: number;
  timeMin: number;
  text: string;
}

/** Corridor network: travel times and route restrictions. Scenario data today; a routing service later. */
export interface Network {
  /** Wodonga hub -> Sydney via the Hume when open, hours */
  humeFromHubH: number;
  /** Wodonga hub -> Sydney via the Olympic Hwy detour, hours */
  olympicFromHubH: number;
  /** From the closure point to Sydney via the Hume after reopening, hours */
  humeFromClosureH: number;
  /** Driver swap at a hub, hours */
  swapH: number;
  /** Cargo classes not permitted on the Olympic detour */
  olympicBannedCargo: CargoClass[];
}

export interface SimState {
  phase: 'idle' | 'running' | 'awaiting_approval' | 'replanning' | 'done';
  clockMin: number;
  mode: 'live' | 'replay';
  model: string;
  hubs: Hub[];
  drivers: Driver[];
  loads: Load[];
  reports: Report[];
  feed: FeedEntry[];
  trace: TraceEntry[];
  approvals: Approval[];
  notifications: Notification[];
  decisions: DecisionRecord[];
  baseline: BaselineItem[]; // 'wait it out' outcome per load, for comparison
  network: Network;
  scenarioId: string;
  seq: number;
}

export interface BaselineItem {
  loadId: string;
  etaMin: number | null;
  costAud: number;
  note: string;
}
