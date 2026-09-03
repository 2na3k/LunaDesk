import type { Bot } from "./types";

let counter = 0;
export function newId(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Seed {
  name: string;
  role: string;
  persona: string;
  preview: string;
  timestamp: string;
  color: string;
  symbol: Bot["symbol"];
}

const seeds: Seed[] = [
  {
    name: "Chief",
    role: "Chief of staff — coordinates the whole crew.",
    persona:
      "You are the chief of staff. You coordinate the other agents, assign follow-ups, and keep the operator's priorities straight. You are decisive and calm.",
    preview: "booked the venue and sent the confirmation…",
    timestamp: "Yesterday",
    color: "#3bb7a9",
    symbol: "circle",
  },
  {
    name: "Sales Outbound",
    role: "Runs outbound prospecting sequences.",
    persona:
      "You run outbound sales. You draft crisp, high-signal prospecting messages, manage sequences, and report reply rates. You are energetic and concise.",
    preview: "Done.",
    timestamp: "12:18 PM",
    color: "#e8873a",
    symbol: "circle",
  },
  {
    name: "Inbox Manager",
    role: "Keeps the inbox at zero.",
    persona:
      "You manage the operator's inbox. You triage, draft replies in their voice, and keep inbox at zero. You summarize what you parked and why.",
    preview: "sent. inbox at zero, 5 drafts parked…",
    timestamp: "9:19 AM",
    color: "#5b6ee0",
    symbol: "triangle",
  },
  {
    name: "Account Manager",
    role: "Owns customer relationships and renewals.",
    persona:
      "You manage key accounts. You track relationships, renewals, and follow-ups, and you tag owners. You are attentive and reliable.",
    preview: "invite's out to vicky. globex note…",
    timestamp: "7:19 AM",
    color: "#9b6ce0",
    symbol: "diamond",
  },
  {
    name: "Talent Scout",
    role: "Sources and warms up candidates.",
    persona:
      "You source talent and draft warm intros in the operator's voice. You keep a shortlist and note who is worth a call. You are perceptive.",
    preview: "3 intros drafted in your voice, held…",
    timestamp: "4:19 AM",
    color: "#4a90d9",
    symbol: "triangle",
  },
  {
    name: "Expense Manager",
    role: "Files reports and reconciles receipts.",
    persona:
      "You handle expenses. You file reports, reconcile receipts, and flag anything unusual. You are precise and low-drama.",
    preview: "report filed. 9 receipts, nothing open.",
    timestamp: "8:19 AM",
    color: "#e8873a",
    symbol: "circle",
  },
];

export function sampleBots(): Bot[] {
  const singles: Bot[] = seeds.map((s) => ({
    id: newId("bot"),
    name: s.name,
    role: s.role,
    persona: s.persona,
    preview: s.preview,
    timestamp: s.timestamp,
    color: s.color,
    symbol: s.symbol,
    members: [],
    messages: [
      {
        id: newId("msg"),
        sender: { kind: "system" },
        body: "No recent messages.",
      },
    ],
  }));

  const offsite: Bot = {
    id: newId("bot"),
    name: "Offsite crew",
    role: "Group chat: the crew closing out the offsite.",
    persona: "A group chat where the crew closes out the offsite together.",
    preview: "that leaves the pipeline. i'd spin up…",
    timestamp: "6:19 AM",
    color: "#4fd1a5",
    symbol: "capsule",
    members: ["Chief", "Account Manager", "Inbox Manager"],
    messages: [
      { id: newId("msg"), sender: { kind: "user" }, body: "let's close out the offsite. what's left?" },
      {
        id: newId("msg"),
        sender: { kind: "bot", name: "Account Manager" },
        body: "recap doc is done and owners are tagged. 3 follow-ups land this week.",
      },
      {
        id: newId("msg"),
        sender: { kind: "bot", name: "Inbox Manager" },
        body: "thank-you notes went out to the venue and the speakers this morning.",
      },
      { id: newId("msg"), sender: { kind: "system" }, body: "6:19 AM" },
      {
        id: newId("msg"),
        sender: { kind: "bot", name: "Chief" },
        body: "recap's shared. follow-ups, assigned:\n✓ Acme pricing follow-up → Account Manager · numbers by thursday\n✓ Speaker + venue thank-yous → Inbox Manager · done this morning\n✓ Final invoice → me · reconciling against the expense report\n👍",
      },
      { id: newId("msg"), sender: { kind: "user" }, body: "great close-out. anything we missed?" },
      {
        id: newId("msg"),
        sender: { kind: "bot", name: "Chief" },
        body: "that leaves the pipeline: nobody's touched the quiet accounts. i'd spin up a dedicated agent for outbound.",
      },
    ],
  };

  return [...singles, offsite];
}
