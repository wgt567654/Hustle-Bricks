/* ============================================================================
   Quick actions — business-customizable shortcuts, surfaced on the dashboard
   and anywhere a shortcut bar makes sense. Selection is stored in
   business_customization.quick_actions (array of ids, in display order).
   ============================================================================ */

export type QuickAction = {
  id: string;
  label: string;
  icon: string;
  href: string;
};

export const QUICK_ACTION_REGISTRY: QuickAction[] = [
  { id: "new_job", label: "New Job", icon: "add_circle", href: "/jobs" },
  { id: "create_quote", label: "New Quote", icon: "request_quote", href: "/quotes/new" },
  { id: "book_job", label: "Book Job", icon: "event_available", href: "/calendar" },
  { id: "add_client", label: "Add Customer", icon: "person_add", href: "/clients?new=1" },
  { id: "collect_payment", label: "Collect Payment", icon: "attach_money", href: "/payments" },
  { id: "send_message", label: "Text a Customer", icon: "sms", href: "/inbox" },
  { id: "create_invoice", label: "Create Invoice", icon: "receipt_long", href: "/jobs" },
  { id: "start_route", label: "Start Route", icon: "route", href: "/canvassing" },
  { id: "add_lead", label: "Add Lead", icon: "person_search", href: "/leads" },
  { id: "team_chat", label: "Team Chat", icon: "forum", href: "/messages" },
  { id: "view_schedule", label: "Today's Schedule", icon: "calendar_month", href: "/calendar" },
  { id: "ask_ai", label: "Ask AI", icon: "auto_awesome", href: "/assistant" },
  { id: "upload_photos", label: "Job Photos", icon: "photo_camera", href: "/jobs" },
];

export function resolveQuickActions(ids: string[]): QuickAction[] {
  const byId = new Map(QUICK_ACTION_REGISTRY.map((a) => [a.id, a]));
  return ids.map((id) => byId.get(id)).filter((a): a is QuickAction => !!a);
}
