"use client";
import { useEffect, useState, useMemo, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Copy,
  Download,
  Ellipsis,
  Eye,
  FileText,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Mail,
  Menu,
  MousePointer2,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Papa from "papaparse";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import ModelTraining from "@/components/model-training";
import { supabase, configured } from "@/lib/supabase";
import {
  seed,
  uid,
  metrics,
  segmentNames,
  kmeans,
  conversionScore,
  abResult,
  recommendations,
  type Store,
  type Customer,
  type Campaign,
  type Product,
  type ABTest,
} from "@/lib/domain";

const nav: { label: string; path: string; icon: LucideIcon; group?: string }[] =
  [
    { label: "Overview", path: "/", icon: LayoutDashboard, group: "WORKSPACE" },
    { label: "Campaign Studio", path: "/campaigns", icon: Sparkles },
    { label: "AI Content Generator", path: "/content", icon: FileText },
    { label: "Audience Intelligence", path: "/audience", icon: Users },
    { label: "Customer Segmentation", path: "/segments", icon: Target },
    { label: "Marketing Channels", path: "/channels", icon: Globe },
    { label: "Campaign Calendar", path: "/calendar", icon: CalendarDays },
    {
      label: "Conversion Prediction",
      path: "/predictions",
      icon: TrendingUp,
      group: "INTELLIGENCE",
    },
    { label: "A/B Testing", path: "/ab-testing", icon: FlaskConical },
    { label: "Marketing Analytics", path: "/analytics", icon: BarChart3 },
    { label: "AI Recommendations", path: "/recommendations", icon: Lightbulb },
    {
      label: "Customer Management",
      path: "/customers",
      icon: Users,
      group: "MANAGEMENT",
    },
    { label: "Product Management", path: "/products", icon: Package },
    { label: "Data Import", path: "/import", icon: Upload },
    { label: "Settings", path: "/settings", icon: Settings },
  ];
const palette = [
  "#7761ed",
  "#a799f3",
  "#c3b9f8",
  "#e0dafa",
  "#34bca2",
  "#f2b05e",
  "#64748b",
];
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const number = (n: number) =>
  new Intl.NumberFormat("en-US", {
    notation: n > 9999 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
const date = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const initial: Store = seed();
function exportFile(name: string, data: unknown, csv = false) {
  const content = csv
    ? Papa.unparse(data as object[], { escapeFormulae: true })
    : JSON.stringify(data, null, 2);
  const blob = new Blob([content], {
    type: csv ? "text/csv;charset=utf-8" : "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`badge ${String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      <i />
      {children}
    </span>
  );
}
function Empty({
  text = "No records yet. Create your first one to get started.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Package size={30} />
      <p>{text}</p>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export default function Workspace() {
  const path = usePathname(),
    router = useRouter();
  const [store, setStore] = useState<Store>(
      configured
        ? {
            ...initial,
            demoData: false,
            customers: [],
            products: [],
            campaigns: [],
            tests: [],
            settings: {
              business: "My workspace",
              name: "Member",
              currency: "USD",
              role: "Marketing Analyst",
            },
          }
        : initial,
    ),
    [ready, setReady] = useState(false),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [editing, setEditing] = useState<Customer | Product | Campaign | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [generated, setGenerated] = useState(""),
    [generationMode, setGenerationMode] = useState(""),
    [channel, setChannel] = useState("All channels"),
    [range, setRange] = useState("All time"),
    [user, setUser] = useState<string | null>(null),
    [org, setOrg] = useState<string | null>(null),
    [authReady, setAuthReady] = useState(!configured),
    [preview, setPreview] = useState<Record<string, string>[]>([]),
    [importType, setImportType] = useState("customers"),
    [filename, setFilename] = useState(""),
    [calendarDate, setCalendarDate] = useState(new Date(2026, 10, 1)),
    [calendarView, setCalendarView] = useState("Month"),
    [selectedCustomer, setSelectedCustomer] = useState("demo-c-0");
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 5000);
  };
  const form = useForm<Record<string, string>>();
  useEffect(() => {
    if (!configured) {
      try {
        const saved = localStorage.getItem("marketinggen-v1");
        if (saved) setStore(JSON.parse(saved));
      } catch {
        notify("Saved workspace could not be loaded. Demo data restored.");
      }
      setReady(true);
      return;
    }
    supabase!.auth.getSession().then(({ data }) => {
      setUser(data.session?.user.email ?? null);
      setAuthReady(true);
      if (!data.session) setReady(true);
    });
    const { data } = supabase!.auth.onAuthStateChange((_, session) => {
      setUser(session?.user.email ?? null);
      if (!session) {
        setOrg(null);
        setReady(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!configured || !user) return;
    let cancelled = false;
    (async () => {
      const membership = await supabase!
        .from("organization_members")
        .select("organization_id,role")
        .limit(1)
        .maybeSingle();
      if (membership.error) {
        notify(membership.error.message);
        setReady(true);
        return;
      }
      if (!membership.data) {
        notify(
          "No workspace found. Apply the database migration and sign up a new account.",
        );
        setReady(true);
        return;
      }
      const id = membership.data.organization_id;
      const result = await supabase!
        .from("workspace_state")
        .select("data")
        .eq("organization_id", id)
        .maybeSingle();
      if (cancelled) return;
      setOrg(id);
      if (result.error) notify(result.error.message);
      const profile = (await supabase!.auth.getUser()).data.user;
      const loaded: Store = result.data?.data ?? {
        ...seed(),
        demoData: false,
        customers: [],
        products: [],
        campaigns: [],
        tests: [],
        settings: {
          business: profile?.user_metadata.organization || "My workspace",
          name: profile?.user_metadata.name || "Member",
          currency: "USD",
          role: membership.data.role,
        },
      };
      setStore({
        ...loaded,
        settings: { ...loaded.settings, role: membership.data.role },
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
  useEffect(() => {
    if (ready && !configured)
      localStorage.setItem("marketinggen-v1", JSON.stringify(store));
  }, [store, ready]);
  const save = (next: Store) => {
    if (configured && store.settings.role === "Marketing Analyst") {
      notify("Your role has read-only access.");
      return;
    }
    setStore(next);
    if (configured && org) {
      supabase!
        .from("workspace_state")
        .upsert({
          organization_id: org,
          data: next,
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) notify("Cloud save failed: " + error.message);
        });
    }
  };
  const go = (p: string) => {
    router.push(p);
    setSearch("");
    setMobile(false);
  };
  const title = nav.find((n) => n.path === path)?.label ?? "Workspace";
  const filtered = useMemo(
    () =>
      store.campaigns.filter(
        (c) =>
          (channel === "All channels" || c.channel === channel) &&
          (range === "All time" ||
            new Date(c.start) >=
              new Date(
                Date.now() - (range === "Last 7 days" ? 7 : 30) * 86400000,
              )),
      ),
    [store.campaigns, channel, range],
  );
  const m = metrics(filtered);
  const open = (
    kind: string,
    item: Customer | Product | Campaign | null = null,
  ) => {
    setEditing(item);
    form.reset(
      item
        ? Object.fromEntries(
            Object.entries(item).map(([k, v]) => [k, String(v)]),
          )
        : { segment: "New customers", consent: "false" },
    );
    setGenerated("");
    setModal(kind);
  };
  const remove = (kind: "customers" | "products" | "campaigns", id: string) => {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    save({ ...store, [kind]: store[kind].filter((x) => x.id !== id) });
    notify("Record deleted");
  };
  const updateCampaign = (id: string, status: string) => {
    if (configured && store.settings.role === "Marketing Analyst") {
      notify("Your role has read-only access.");
      return;
    }
    save({
      ...store,
      campaigns: store.campaigns.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
    });
    notify(
      status === "Scheduled"
        ? "Schedule saved. Delivery requires a connected provider."
        : `Campaign marked ${status.toLowerCase()}. No messages were sent.`,
    );
  };
  async function generate(values: Record<string, string>, kind = "campaign") {
    setBusy(true);
    try {
      const session = configured
        ? (await supabase!.auth.getSession()).data.session
        : null;
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ ...values, kind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      setGenerated(data.content);
      setGenerationMode(data.mode);
      notify(
        data.mode === "demo"
          ? "Demo template generated. Configure OpenAI for live AI."
          : "AI content generated",
      );
      return data.content as string;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Generation failed");
      return "";
    } finally {
      setBusy(false);
    }
  }
  function submitRecord(values: Record<string, string>) {
    if (configured && store.settings.role === "Marketing Analyst") {
      notify("Your role has read-only access.");
      return;
    }
    if (modal === "customer") {
      const c: Customer = {
        id: editing?.id ?? uid(),
        name: values.name,
        email: values.email,
        location: values.location || "",
        age: values.age || "25–34",
        interests: values.interests || "",
        spending: Number(values.spending || 0),
        purchases: Number(values.purchases || 0),
        visits: Number(values.visits || 0),
        engagement: Number(values.engagement || 0),
        recency: Number(values.recency || 0),
        consent: values.consent === "true",
        segment: values.segment || "New customers",
      };
      if (
        store.customers.some(
          (x) =>
            x.email.toLowerCase() === c.email.toLowerCase() && x.id !== c.id,
        )
      ) {
        notify("A customer with this email already exists.");
        return;
      }
      save({
        ...store,
        customers: editing
          ? store.customers.map((x) => (x.id === c.id ? c : x))
          : [c, ...store.customers],
      });
    }
    if (modal === "product") {
      const p: Product = {
        id: editing?.id ?? uid(),
        name: values.name,
        category: values.category || "Lifestyle",
        description: values.description || "",
        price: Number(values.price || 0),
        discount: Number(values.discount || 0),
        audience: values.audience || "",
        url: values.url || "",
      };
      save({
        ...store,
        products: editing
          ? store.products.map((x) => (x.id === p.id ? p : x))
          : [p, ...store.products],
      });
    }
    if (modal === "campaign") {
      const c: Campaign = {
        id: editing?.id ?? uid(),
        name: values.name,
        product: values.product || "",
        audience: values.audience || "All opted-in customers",
        channel: values.channel || "Email",
        objective: values.objective || "Increase Sales",
        tone: values.tone || "Friendly",
        budget: Number(values.budget || 0),
        start: values.start || new Date().toISOString().slice(0, 10),
        end: values.end || new Date().toISOString().slice(0, 10),
        status: values.status || "Draft",
        impressions: Number(values.impressions || 0),
        clicks: Number(values.clicks || 0),
        conversions: Number(values.conversions || 0),
        revenue: Number(values.revenue || 0),
        content: generated || values.content || "",
      };
      if (c.end < c.start) {
        notify("End date must follow start date.");
        return;
      }
      if (c.conversions > c.clicks || c.clicks > c.impressions) {
        notify(
          "Recorded counts must satisfy conversions ≤ clicks ≤ impressions.",
        );
        return;
      }
      save({
        ...store,
        campaigns: editing
          ? store.campaigns.map((x) => (x.id === c.id ? c : x))
          : [c, ...store.campaigns],
      });
    }
    setModal(null);
    notify("Saved to your workspace");
  }
  function campaignTable(items: Campaign[]) {
    return items.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Campaign name</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Conversions</th>
              <th>Revenue</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c, i) => (
              <tr key={c.id}>
                <td>
                  <button
                    className="name-cell"
                    onClick={() => open("campaign", c)}
                  >
                    <span className={`table-icon color-${i % 4}`}>
                      <Mail size={17} />
                    </span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.audience}</small>
                    </span>
                  </button>
                </td>
                <td>{c.channel}</td>
                <td>
                  <Badge>{c.status}</Badge>
                </td>
                <td>{money(c.budget)}</td>
                <td>{c.conversions}</td>
                <td className="strong">{money(c.revenue)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      title="Edit campaign"
                      onClick={() => open("campaign", c)}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      title="Duplicate"
                      onClick={() => {
                        save({
                          ...store,
                          campaigns: [
                            {
                              ...c,
                              id: uid(),
                              name: c.name + " (copy)",
                              status: "Draft",
                              impressions: 0,
                              clicks: 0,
                              conversions: 0,
                              revenue: 0,
                            },
                            ...store.campaigns,
                          ],
                        });
                        notify("Draft duplicated");
                      }}
                    >
                      <Copy size={15} />
                    </button>
                    {path === "/campaigns" && (
                      <>
                        <button
                          title={
                            c.status === "Paused" ? "Resume planning" : "Pause"
                          }
                          onClick={() =>
                            updateCampaign(
                              c.id,
                              c.status === "Paused" ? "Draft" : "Paused",
                            )
                          }
                        >
                          <Activity size={15} />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => remove("campaigns", c.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty />
    );
  }
  const cards = [
    {
      label: "Total revenue",
      value: money(m.revenue),
      icon: Wallet,
      detail: "Revenue recorded across campaigns",
      color: "purple",
    },
    {
      label: "Total conversions",
      value: number(m.conversions),
      icon: MousePointer2,
      detail: "Attributed campaign conversions",
      color: "green",
    },
    {
      label: "Conversion rate",
      value: m.cvr.toFixed(2) + "%",
      icon: TrendingUp,
      detail: "Conversions ÷ recorded clicks",
      color: "blue",
    },
    {
      label: "Active campaigns",
      value: String(
        filtered.filter((c) => c.status === "Active").length,
      ).padStart(2, "0"),
      icon: Zap,
      detail: `${filtered.length} campaigns in your workspace`,
      color: "orange",
    },
  ];
  const channelData = Array.from(new Set(filtered.map((c) => c.channel))).map(
    (name) => ({
      name,
      ...metrics(filtered.filter((c) => c.channel === name)),
    }),
  );
  const trendData = filtered
    .map((c) => ({
      name: date(c.start),
      revenue: c.revenue,
      conversions: c.conversions,
      clicks: c.clicks,
    }))
    .sort(
      (a, b) =>
        new Date(a.name + ", 2026").getTime() -
        new Date(b.name + ", 2026").getTime(),
    );
  const statCards = (
    <div className="stats-grid">
      {cards.map(({ label, value, icon: Icon, detail, color }) => (
        <div className="stat-card" key={label}>
          <div className="stat-top">
            <span>{label}</span>
            <span className={`stat-icon ${color}`}>
              <Icon size={18} />
            </span>
          </div>
          <strong>{value}</strong>
          <p>{detail}</p>
          <div className={`mini-line ${color}`}>
            <svg viewBox="0 0 140 24">
              <path d="M0 22 L12 18 L24 20 L36 11 L48 15 L60 9 L72 12 L84 5 L96 8 L108 2 L120 5 L140 0" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
  const recs = recommendations(store);
  const overview = (
    <>
      {statCards}
      <div className="chart-grid">
        <Panel
          title="Campaign performance"
          subtitle="A clearer picture of your marketing impact"
          action={
            <div className="chart-legend">
              <i />
              Revenue <i />
              Conversions
            </div>
          }
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8668ed" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#8668ed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="#ececf2"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9694a5" }}
                  minTickGap={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9694a5" }}
                  tickFormatter={(v) => "$" + number(v)}
                />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8062e5"
                  strokeWidth={3}
                  fill="url(#revenue)"
                />
                <Area
                  type="monotone"
                  dataKey="conversions"
                  stroke="#4dc2aa"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
            <span>
              <span className="dot" /> Campaign-level totals ·{" "}
              {configured ? "Workspace data" : "Demo dataset"}
            </span>
            <button className="text-button" onClick={() => go("/analytics")}>
              View analytics <ArrowRight size={14} />
            </button>
          </div>
        </Panel>
        <Panel
          title="Channel mix"
          subtitle="Where your conversions happen"
          action={
            <button
              className="icon-button"
              title="Channel settings"
              onClick={() => go("/channels")}
            >
              <Ellipsis size={20} />
            </button>
          }
        >
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelData}
                  dataKey="conversions"
                  innerRadius={68}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={palette[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-label">
              <strong>{number(m.conversions)}</strong>
              <small>conversions</small>
            </div>
          </div>
          <div className="channel-legend">
            {channelData.slice(0, 4).map((c, i) => (
              <div key={c.name}>
                <span>
                  <i style={{ background: palette[i] }} />
                  {c.name}
                </span>
                <strong>
                  {m.conversions
                    ? Math.round((c.conversions / m.conversions) * 100)
                    : 0}
                  %
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="section-line">
        <div>
          <h2>Your campaigns</h2>
          <p>Good ideas. Meaningful connections. Measurable results.</p>
        </div>
        <button className="text-button" onClick={() => go("/campaigns")}>
          View all campaigns <ArrowRight size={16} />
        </button>
      </div>
      <section className="panel">{campaignTable(filtered.slice(0, 4))}</section>
      <div className="section-line">
        <div className="inline">
          <span className="sparkle-box">
            <Sparkles size={18} />
          </span>
          <h2>A little intelligence. A lot of possibility.</h2>
          <span className="tag">AI insights</span>
        </div>
        <button className="text-button" onClick={() => go("/recommendations")}>
          Explore all insights <ArrowRight size={16} />
        </button>
      </div>
      <div className="recommendation-grid">
        {recs.map((r, i) => (
          <article className="insight-card" key={r.title}>
            <span className={`insight-symbol color-${i}`}>
              {i === 0 ? (
                <Users size={19} />
              ) : i === 1 ? (
                <Sparkles size={19} />
              ) : (
                <TrendingUp size={19} />
              )}
            </span>
            <small>{r.type}</small>
            <h3>{r.title}</h3>
            <p>{r.detail}</p>
            <button
              className="text-button"
              onClick={() => (i === 1 ? go("/ab-testing") : open("campaign"))}
            >
              {r.action} <ArrowUpRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </>
  );
  const query = search.toLowerCase();
  const customersPage = (
    <>
      <div className="summary-strip">
        <span>
          <strong>{store.customers.length}</strong> customers
        </span>
        <span>
          <strong>{store.customers.filter((c) => c.consent).length}</strong>{" "}
          opted in
        </span>
        <span>
          <strong>
            {money(store.customers.reduce((a, c) => a + c.spending, 0))}
          </strong>{" "}
          lifetime spend
        </span>
        <button
          className="text-button"
          onClick={() => exportFile("customers.csv", store.customers, true)}
        >
          <Download size={15} /> Export CSV
        </button>
      </div>
      <Panel
        title={
          path === "/audience"
            ? "Know the people behind the numbers"
            : "Your customer community"
        }
        subtitle="Customer profiles, engagement, and consent in one place"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Location</th>
                <th>Segment</th>
                <th>Total spent</th>
                <th>Engagement</th>
                <th>Consent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {store.customers
                .filter((c) =>
                  (c.name + c.email + c.segment).toLowerCase().includes(query),
                )
                .map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        className="name-cell"
                        onClick={() => open("customer", c)}
                      >
                        <span className="avatar">
                          {c.name
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.email}</small>
                        </span>
                      </button>
                    </td>
                    <td>{c.location}</td>
                    <td>
                      <span className="segment-tag">{c.segment}</span>
                    </td>
                    <td>{money(c.spending)}</td>
                    <td>
                      <div className="progress">
                        <i style={{ width: c.engagement + "%" }} />
                      </div>
                      {c.engagement}%
                    </td>
                    <td>
                      <Badge>{c.consent ? "Opted in" : "Opted out"}</Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        title="Delete customer"
                        onClick={() => remove("customers", c.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!store.customers.length && <Empty />}
      </Panel>
    </>
  );
  const productsPage = (
    <div className="product-grid">
      {store.products
        .filter((p) => (p.name + p.category).toLowerCase().includes(query))
        .map((p, i) => (
          <article className="product-card" key={p.id}>
            <div className={`product-art color-${i % 4}`}>
              <Package size={58} strokeWidth={1} />
              <span>{p.category}</span>
            </div>
            <div className="product-info">
              <div className="inline between">
                <h3>{p.name}</h3>
                <strong>{money(p.price)}</strong>
              </div>
              <p>{p.description}</p>
              <small>
                {p.discount
                  ? `${p.discount}% promotional discount`
                  : "No promotional discount"}
              </small>
              <div className="product-actions">
                <button
                  className="secondary"
                  onClick={() => open("product", p)}
                >
                  Edit product
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    open("campaign");
                    form.setValue("product", p.name);
                    form.setValue("audience", p.audience);
                  }}
                >
                  Create campaign <ArrowUpRight size={14} />
                </button>
                <button
                  className="icon-button"
                  title="Delete product"
                  onClick={() => remove("products", p.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      {!store.products.length && <Empty />}
    </div>
  );
  const segments = Array.from(
    new Set(store.customers.map((c) => c.segment)),
  ).map((name) => {
    const cs = store.customers.filter((c) => c.segment === name);
    return {
      name,
      count: cs.length,
      spending: cs.reduce((a, c) => a + c.spending, 0) / cs.length,
      engagement: cs.reduce((a, c) => a + c.engagement, 0) / cs.length,
      purchases: cs.reduce((a, c) => a + c.purchases, 0) / cs.length,
    };
  });
  const segmentPage = (
    <>
      <div className="notice">
        <Target size={18} />
        <span>
          Run K-Means on standardized spending, purchase frequency, recency,
          engagement, and website visits. Cluster numbers identify groups; they
          do not imply customer intent.
        </span>
        <button
          className="secondary"
          onClick={() => {
            save({ ...store, customers: kmeans(store.customers) });
            notify(
              "K-Means segmentation completed on your current customer data",
            );
          }}
        >
          Run segmentation
        </button>
      </div>
      <div className="chart-grid">
        <Panel title="Audience landscape" subtitle="Customers in each segment">
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segments}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8870ed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="An audience with potential"
          subtitle="Personalization starts with context"
        >
          <div className="big-stat">
            {store.customers.length}
            <span>unique customer profiles</span>
          </div>
          <p className="panel-copy">
            Use a segment to shape your message, then test your assumptions with
            measured results. Only opted-in customers should receive marketing.
          </p>
        </Panel>
      </div>
      <div className="recommendation-grid">
        {segments.map((s) => (
          <article className="insight-card" key={s.name}>
            <span className="segment-tag">{s.count} customers</span>
            <h3>{s.name}</h3>
            <p>
              Average spend {money(s.spending)} · {s.purchases.toFixed(1)}{" "}
              purchases · {s.engagement.toFixed(0)}% engagement.
            </p>
            <p>
              Test a relevant product benefit and a clear call to action for
              this group.
            </p>
            <button
              className="text-button"
              onClick={() => {
                open("campaign");
                form.setValue("audience", s.name);
              }}
            >
              Create personalized campaign <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
    </>
  );
  const contentPage = (
    <div className="studio-grid">
      <Panel
        title="What would you like to create?"
        subtitle="Turn a product story into a meaningful connection"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await generate(
              Object.fromEntries(new FormData(e.currentTarget)) as Record<
                string,
                string
              >,
              "content",
            );
          }}
          className="stack"
        >
          <Field label="Product name">
            <input name="product" required placeholder="e.g. Aura Smartwatch" />
          </Field>
          <Field label="Product description">
            <textarea
              name="description"
              required
              placeholder="What makes your product special?"
              rows={3}
            />
          </Field>
          <Field label="Target audience">
            <input
              name="audience"
              required
              placeholder="e.g. Health-conscious professionals"
            />
          </Field>
          <div className="form-grid">
            <Field label="Content format">
              <select name="channel">
                {[
                  "Instagram Post",
                  "Instagram Caption",
                  "Facebook Advertisement",
                  "Google Ads",
                  "Email Marketing",
                  "WhatsApp Message",
                  "SMS",
                  "Product Description",
                  "Promotional Message",
                  "Landing Page Copy",
                  "Blog Introduction",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Brand voice">
              <select name="tone">
                {[
                  "Friendly",
                  "Professional",
                  "Luxury",
                  "Emotional",
                  "Persuasive",
                  "Creative",
                  "Urgent",
                  "Informative",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Campaign goal">
              <select name="objective">
                {[
                  "Increase Sales",
                  "Generate Leads",
                  "Increase Website Traffic",
                  "Improve Brand Awareness",
                  "Retain Customers",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Language">
              <select name="language">
                {["English", "Hindi", "Telugu", "Spanish", "French"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </Field>
          </div>
          <Field label="Keywords and promotional offer">
            <input name="offer" placeholder="e.g. wellness, premium, 15% off" />
          </Field>
          <button className="primary" disabled={busy}>
            <Sparkles size={16} />
            {busy
              ? "Creating your content…"
              : generated
                ? "Regenerate content"
                : "Generate content"}
          </button>
        </form>
      </Panel>
      <Panel
        title="Your next great message"
        subtitle={
          generationMode === "live"
            ? "Generated with OpenAI"
            : generationMode === "demo"
              ? "Demo template · not live AI generation"
              : "Your generated content will appear here"
        }
      >
        {generated ? (
          <>
            <textarea
              className="generated-text"
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
            />
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(generated);
                  notify("Copied to clipboard");
                }}
              >
                <Copy size={15} /> Copy
              </button>
              <button
                className="primary"
                onClick={() => {
                  save({
                    ...store,
                    content: [
                      {
                        id: uid(),
                        name: generated.split("\n")[0].slice(0, 65),
                        content: generated,
                        channel: "Generated",
                        created: new Date().toISOString(),
                        mode: generationMode,
                      },
                      ...store.content,
                    ],
                  });
                  notify("Content saved to your library");
                }}
              >
                <Check size={15} /> Save content
              </button>
              <button
                className="secondary"
                onClick={() =>
                  exportFile("marketing-content.json", {
                    content: generated,
                    mode: generationMode,
                  })
                }
              >
                <Download size={15} />
              </button>
            </div>
          </>
        ) : (
          <div className="generation-empty">
            <span>
              <Sparkles size={35} />
            </span>
            <h3>A blank page, full of possibility.</h3>
            <p>
              Add your product and audience details.
              <br />
              We’ll help you find the right words.
            </p>
          </div>
        )}
      </Panel>
      <div className="full-width">
        <Panel
          title="Your content library"
          subtitle={`${store.content.length} saved pieces`}
        >
          {store.content.length ? (
            <div className="saved-grid">
              {store.content.map((c) => (
                <article key={c.id}>
                  <Badge>
                    {c.mode === "live" ? "AI generated" : "Demo template"}
                  </Badge>
                  <h3>{c.name}</h3>
                  <p>{c.content.slice(0, 180)}…</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setGenerated(c.content);
                      setGenerationMode(c.mode);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Open and edit <ArrowRight size={14} />
                  </button>
                  <button
                    className="icon-button"
                    title="Delete saved content"
                    onClick={() =>
                      save({
                        ...store,
                        content: store.content.filter((x) => x.id !== c.id),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="Your saved content will live here." />
          )}
        </Panel>
      </div>
    </div>
  );
  const predictionPage = (
    <>
      <ModelTraining notify={notify} />
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          Browser scores are illustrative, untrained heuristics. Connect the
          Python service to train Logistic Regression or Random Forest, evaluate
          a held-out test set, and obtain model-based predictions. Scores never
          guarantee a conversion.
        </span>
      </div>
      <div className="studio-grid">
        <Panel
          title="Explore conversion potential"
          subtitle="Choose a customer to inspect their engagement signals"
        >
          <div className="stack">
            <Field label="Customer">
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                {store.customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {(() => {
              const c = store.customers.find((x) => x.id === selectedCustomer);
              return c ? (
                <>
                  <div className="signal-grid">
                    {[
                      ["Engagement", c.engagement + "%"],
                      ["Website visits", c.visits],
                      ["Purchases", c.purchases],
                      ["Days since purchase", c.recency],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <small>{k}</small>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <button
                    className="primary"
                    onClick={async () => {
                      const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
                      if (backend) {
                        setBusy(true);
                        try {
                          const session = (await supabase?.auth.getSession())
                            ?.data.session;
                          const r = await fetch(backend + "/api/ml/predict", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...(session
                                ? {
                                    Authorization: `Bearer ${session.access_token}`,
                                  }
                                : {}),
                            },
                            body: JSON.stringify(c),
                          });
                          const d = await r.json();
                          if (!r.ok)
                            throw new Error(d.detail || "Prediction failed");
                          save({
                            ...store,
                            predictions: [
                              {
                                id: uid(),
                                name: c.name,
                                probability: d.probability,
                                created: new Date().toISOString(),
                                model: d.model,
                              },
                              ...store.predictions,
                            ],
                          });
                          notify("Model prediction saved");
                        } catch (e) {
                          notify(String(e));
                        } finally {
                          setBusy(false);
                        }
                      } else {
                        save({
                          ...store,
                          predictions: [
                            {
                              id: uid(),
                              name: c.name,
                              probability: conversionScore(c),
                              created: new Date().toISOString(),
                              model: "Demo heuristic (untrained)",
                            },
                            ...store.predictions,
                          ],
                        });
                        notify("Illustrative score saved");
                      }
                    }}
                    disabled={busy}
                  >
                    <TrendingUp size={16} />{" "}
                    {busy ? "Predicting…" : "Estimate conversion potential"}
                  </button>
                </>
              ) : (
                <Empty />
              );
            })()}
          </div>
        </Panel>
        <Panel
          title="Latest estimate"
          subtitle={store.predictions[0]?.model ?? "No predictions yet"}
        >
          {store.predictions.length ? (
            <>
              <div className="prediction-ring">
                <strong>
                  {(store.predictions[0].probability * 100).toFixed(1)}
                  <small>%</small>
                </strong>
              </div>
              <h3 className="center">{store.predictions[0].name}</h3>
              <p className="center muted">
                {store.predictions[0].probability > 0.65
                  ? "High"
                  : store.predictions[0].probability > 0.35
                    ? "Medium"
                    : "Low"}{" "}
                illustrative conversion potential
              </p>
              <p className="panel-copy">
                Recommended next action:{" "}
                {store.predictions[0].probability > 0.65
                  ? "Test a personalized product offer with consent."
                  : "Build trust with educational content and measure engagement."}
              </p>
            </>
          ) : (
            <Empty text="Run your first estimate to see the result." />
          )}
        </Panel>
      </div>
      <Panel
        title="Prediction history"
        subtitle="Model provenance is recorded with every estimate"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Probability</th>
                <th>Model</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {store.predictions.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{(p.probability * 100).toFixed(1)}%</td>
                  <td>{p.model}</td>
                  <td>{new Date(p.created).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
  const abPage = (
    <>
      <div className="notice">
        <FlaskConical size={18} />
        <span>
          Two-proportion z-test, two-sided 95% threshold. Each arm needs at
          least 10 conversions and 10 non-conversions. Report a winner only
          after your planned test duration.
        </span>
      </div>
      <div className="recommendation-grid">
        {store.tests.map((t) => {
          const r = abResult(t);
          return (
            <Panel
              key={t.id}
              title={t.name}
              subtitle={
                r.sufficient
                  ? "Sample-size rule satisfied"
                  : "Insufficient sample size"
              }
            >
              <div className="ab-variants">
                {[
                  ["A", t.a, t.visitorsA, t.conversionsA, r.rateA],
                  ["B", t.b, t.visitorsB, t.conversionsB, r.rateB],
                ].map(([label, text, v, c, rate]) => (
                  <div key={String(label)}>
                    <span className="segment-tag">Variation {label}</span>
                    <h3>{text}</h3>
                    <strong>{(Number(rate) * 100).toFixed(2)}%</strong>
                    <p>
                      {v} visitors · {c} conversions
                    </p>
                  </div>
                ))}
              </div>
              <div className="test-result">
                <FlaskConical size={17} />
                {r.winner}
                {r.sufficient && ` · z = ${r.z.toFixed(2)}`}
              </div>
              <button
                className="text-button"
                onClick={() => {
                  if (confirm("Delete this test?"))
                    save({
                      ...store,
                      tests: store.tests.filter((x) => x.id !== t.id),
                    });
                }}
              >
                Delete test
              </button>
            </Panel>
          );
        })}
      </div>
      {!store.tests.length && <Empty />}
    </>
  );
  const channelsPage = (
    <>
      <div className="notice">
        <Globe size={18} />
        <span>
          No live delivery providers are connected. Saved campaign statuses are
          planning states. This application does not send or publish
          advertisements.
        </span>
      </div>
      <div className="product-grid">
        {[
          "Instagram",
          "Facebook",
          "Google Ads",
          "Email Marketing",
          "WhatsApp Business",
          "SMS",
        ].map((c, i) => (
          <Panel key={c} title={c} subtitle="Official API integration">
            <div className={`channel-logo color-${i % 4}`}>
              {c === "Email Marketing" ? (
                <Mail size={28} />
              ) : (
                <Globe size={28} />
              )}
            </div>
            <Badge>Not connected</Badge>
            <p className="panel-copy">
              Configure provider credentials, OAuth scopes, verified senders,
              and consent checks in your backend before enabling delivery.
            </p>
            <dl className="detail-list">
              <dt>Permissions</dt>
              <dd>None granted</dd>
              <dt>Last synchronized</dt>
              <dd>Never</dd>
              <dt>Available actions</dt>
              <dd>Campaign planning only</dd>
            </dl>
            <button
              className="secondary"
              onClick={() => {
                setModal("integration:" + c);
              }}
            >
              View setup guide <ArrowUpRight size={14} />
            </button>
          </Panel>
        ))}
      </div>
    </>
  );
  const analyticsPage = (
    <>
      {statCards}
      <div className="stats-grid compact">
        {[
          ["Impressions", number(m.impressions)],
          ["Clicks / CTR", `${number(m.clicks)} / ${m.ctr.toFixed(2)}%`],
          ["Acquisition cost", money(m.cac)],
          ["Marketing ROI", m.roi.toFixed(1) + "%"],
        ].map(([k, v]) => (
          <div className="stat-card" key={k}>
            <p>{k}</p>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <Panel
          title="Channel comparison"
          subtitle="Recorded revenue and marketing spend"
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => number(v)} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#8466eb" radius={[5, 5, 0, 0]} />
                <Bar dataKey="spend" fill="#d9d0fb" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Acquisition funnel"
          subtitle="Recorded totals across the selected campaigns"
        >
          <div className="funnel">
            {[
              ["Impressions", m.impressions],
              ["Clicks", m.clicks],
              ["Conversions", m.conversions],
            ].map(([k, v], i) => (
              <div key={k}>
                <span>
                  {k}
                  <strong>{number(Number(v))}</strong>
                </span>
                <div
                  style={{ width: 100 - i * 22 + "%", background: palette[i] }}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Campaign comparison"
        action={
          <button
            className="secondary"
            onClick={() => exportFile("campaign-analytics.csv", filtered, true)}
          >
            <Download size={15} /> Download report
          </button>
        }
      >
        {campaignTable(filtered)}
      </Panel>
    </>
  );
  const monthDays = new Date(
      calendarDate.getFullYear(),
      calendarDate.getMonth() + 1,
      0,
    ).getDate(),
    firstDay = new Date(
      calendarDate.getFullYear(),
      calendarDate.getMonth(),
      1,
    ).getDay();
  const calendarPage = (
    <Panel
      title={calendarDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}
      subtitle="Plan thoughtful campaigns, one moment at a time"
      action={
        <div className="button-row">
          <select
            value={calendarView}
            onChange={(e) => setCalendarView(e.target.value)}
          >
            {["Month", "Week", "Day"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className="icon-button"
            title="Previous period"
            onClick={() =>
              setCalendarDate(
                new Date(
                  calendarDate.getFullYear(),
                  calendarDate.getMonth() - (calendarView === "Month" ? 1 : 0),
                  calendarDate.getDate() -
                    (calendarView === "Week"
                      ? 7
                      : calendarView === "Day"
                        ? 1
                        : 0),
                ),
              )
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            title="Next period"
            onClick={() =>
              setCalendarDate(
                new Date(
                  calendarDate.getFullYear(),
                  calendarDate.getMonth() + (calendarView === "Month" ? 1 : 0),
                  calendarDate.getDate() +
                    (calendarView === "Week"
                      ? 7
                      : calendarView === "Day"
                        ? 1
                        : 0),
                ),
              )
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      }
    >
      {calendarView === "Month" ? (
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div className="calendar-day-name" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }, (_, i) => (
            <div className="calendar-cell blank" key={"b" + i} />
          ))}
          {Array.from({ length: monthDays }, (_, i) => {
            const ds = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            return (
              <div className="calendar-cell" key={ds}>
                <button
                  className="day-number"
                  onClick={() => {
                    open("campaign");
                    form.setValue("start", ds);
                    form.setValue("end", ds);
                    form.setValue("status", "Scheduled");
                  }}
                >
                  {i + 1}
                  <Plus size={11} />
                </button>
                {store.campaigns
                  .filter((c) => c.start === ds)
                  .map((c) => (
                    <button
                      className="calendar-event"
                      key={c.id}
                      onClick={() => open("campaign", c)}
                    >
                      {c.name}
                      <small>
                        {c.channel} · {c.status}
                      </small>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stack">
          {Array.from({ length: calendarView === "Week" ? 7 : 1 }, (_, i) => {
            const d = new Date(calendarDate);
            d.setDate(d.getDate() + i);
            const ds = [
              d.getFullYear(),
              String(d.getMonth() + 1).padStart(2, "0"),
              String(d.getDate()).padStart(2, "0"),
            ].join("-");
            return (
              <div className="agenda-day" key={ds}>
                <h3>
                  {d.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
                {store.campaigns
                  .filter((c) => c.start === ds)
                  .map((c) => (
                    <button
                      className="calendar-event"
                      key={c.id}
                      onClick={() => open("campaign", c)}
                    >
                      {c.name} · {c.channel}
                    </button>
                  ))}
                <button
                  className="text-button"
                  onClick={() => {
                    open("campaign");
                    form.setValue("start", ds);
                    form.setValue("end", ds);
                  }}
                >
                  + Schedule campaign
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
  async function importRows() {
    const good: Record<string, string>[] = [],
      seen = new Set<string>();
    let skipped = 0;
    for (const row of preview) {
      const identity = (importType === "customers" ? row.email : row.name)
        ?.trim()
        .toLowerCase();
      const exists =
        importType === "customers"
          ? store.customers.some((c) => c.email.toLowerCase() === identity)
          : importType === "products"
            ? store.products.some((p) => p.name.toLowerCase() === identity)
            : store.campaigns.some((c) => c.name.toLowerCase() === identity);
      const numericFields =
        importType === "customers"
          ? ["spending", "purchases", "visits", "engagement", "recency"]
          : importType === "products"
            ? ["price", "discount"]
            : ["budget"];
      const invalid =
        numericFields.some(
          (k) =>
            row[k] !== undefined &&
            (row[k].trim() === "" ||
              !Number.isFinite(Number(row[k])) ||
              Number(row[k]) < 0),
        ) ||
        (importType === "customers" &&
          (Number(row.engagement || 0) > 100 ||
            !/^\S+@\S+\.\S+$/.test(row.email || "")));
      if (
        !identity ||
        !row.name?.trim() ||
        seen.has(identity) ||
        exists ||
        invalid
      ) {
        skipped++;
        continue;
      }
      seen.add(identity);
      good.push(row);
    }
    if (!good.length) {
      notify(
        "No valid, unique rows found. Check required names, email addresses, and nonnegative numbers.",
      );
      return;
    }
    const mapped = good.map((row) =>
      importType === "customers"
        ? {
            id: uid(),
            name: row.name,
            email: row.email,
            location: row.location || "",
            age: row.age || "",
            interests: row.interests || "",
            spending: Number(row.spending || 0),
            purchases: Number(row.purchases || 0),
            visits: Number(row.visits || 0),
            engagement: Number(row.engagement || 0),
            recency: Number(row.recency || 0),
            consent: row.consent?.toLowerCase() === "true",
            segment: row.segment || "New customers",
          }
        : importType === "products"
          ? {
              id: uid(),
              name: row.name,
              category: row.category || "General",
              description: row.description || "",
              price: Number(row.price || 0),
              discount: Number(row.discount || 0),
              audience: row.audience || "",
              url: row.url || "",
            }
          : {
              id: uid(),
              name: row.name,
              product: row.product || "",
              audience: row.audience || "",
              channel: row.channel || "Email",
              objective: row.objective || "Increase Sales",
              tone: "Friendly",
              budget: Number(row.budget || 0),
              start: row.start || new Date().toISOString().slice(0, 10),
              end: row.end || new Date().toISOString().slice(0, 10),
              status: "Draft",
              impressions: 0,
              clicks: 0,
              conversions: 0,
              revenue: 0,
              content: "",
            },
    );
    save({
      ...store,
      [importType]: [
        ...mapped,
        ...store[importType as "customers" | "products" | "campaigns"],
      ],
      imports: [
        {
          id: uid(),
          name: filename,
          rows: good.length,
          created: new Date().toISOString(),
        },
        ...store.imports,
      ],
    });
    setPreview([]);
    notify(
      `${good.length} rows imported; ${skipped} invalid or duplicate rows skipped`,
    );
  }
  const importPage = (
    <>
      <Panel
        title="Make your data feel at home"
        subtitle="Import customers, products, or campaign plans from CSV"
      >
        <div className="import-layout">
          <div className="stack">
            <Field label="Data type">
              <select
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value);
                  setPreview([]);
                }}
              >
                {["customers", "products", "campaigns"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <label className="dropzone">
              <Upload size={32} />
              <strong>Choose a CSV file</strong>
              <span>Up to 2 MB · 5,000 rows · UTF-8</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (
                    f.size > 2 * 1024 * 1024 ||
                    !f.name.toLowerCase().endsWith(".csv")
                  ) {
                    notify("Choose a CSV file smaller than 2 MB");
                    return;
                  }
                  setFilename(f.name);
                  Papa.parse<Record<string, string>>(f, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (h) => h.trim().toLowerCase(),
                    complete: (r) => {
                      if (r.errors.length) {
                        notify("CSV parsing failed: " + r.errors[0].message);
                        return;
                      }
                      if (r.data.length > 5000) {
                        notify("Limit imports to 5,000 rows");
                        return;
                      }
                      setPreview(r.data);
                      notify("Preview ready. Review before importing.");
                    },
                  });
                }}
              />
            </label>
            <button
              className="text-button"
              onClick={() =>
                exportFile(
                  `${importType}-template.csv`,
                  importType === "customers"
                    ? [
                        {
                          name: "Sample Customer",
                          email: "sample@example.com",
                          location: "Hyderabad",
                          spending: 0,
                          purchases: 0,
                          engagement: 50,
                          consent: false,
                        },
                      ]
                    : importType === "products"
                      ? [
                          {
                            name: "Sample Product",
                            category: "Lifestyle",
                            description: "Description",
                            price: 99,
                            discount: 0,
                            audience: "Professionals",
                          },
                        ]
                      : [
                          {
                            name: "Sample campaign",
                            product: "Sample product",
                            channel: "Email",
                            budget: 500,
                            start: "2026-11-10",
                            end: "2026-11-30",
                          },
                        ],
                  true,
                )
              }
            >
              <Download size={15} /> Download CSV template
            </button>
          </div>
          <div className="import-guidance">
            <h3>A clean start makes all the difference.</h3>
            <p>
              Headers must match the template. Names and customer emails are
              required. Numeric fields must be nonnegative. Duplicate emails or
              product/campaign names are skipped.
            </p>
            <p>
              Marketing consent defaults to false. Import only information you
              have permission to process.
            </p>
            <button
              className="secondary"
              onClick={() => {
                if (
                  confirm("Replace your workspace with labeled sample data?")
                ) {
                  save(seed());
                  notify(
                    "Demo dataset loaded: 120 customers, 20 products, 12 campaigns",
                  );
                }
              }}
            >
              Load sample dataset
            </button>
          </div>
        </div>
      </Panel>
      {preview.length > 0 && (
        <Panel
          title={`Preview · ${filename}`}
          subtitle={`${preview.length} rows · showing first 5`}
          action={
            <button className="primary" onClick={importRows}>
              <Check size={16} /> Confirm import
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {Object.keys(preview[0]).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel title="Import history">
        {store.imports.length ? (
          <div className="stack">
            {store.imports.map((i) => (
              <div className="history-row" key={i.id}>
                <FileText size={18} />
                <strong>{i.name}</strong>
                <span>{i.rows} rows</span>
                <span>{new Date(i.created).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Your import history will appear here." />
        )}
      </Panel>
    </>
  );
  const settingsPage = (
    <div className="studio-grid">
      <Panel
        title="Your workspace"
        subtitle="The details behind your next growth story"
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({
              ...store,
              settings: {
                ...store.settings,
                business: String(f.get("business")),
                name: String(f.get("name")),
                currency: "USD",
              },
            });
            notify("Workspace settings saved");
          }}
        >
          <Field label="Organization name">
            <input
              name="business"
              required
              defaultValue={store.settings.business}
            />
          </Field>
          <Field label="Your name">
            <input name="name" required defaultValue={store.settings.name} />
          </Field>
          <Field label="Role">
            <input readOnly value={store.settings.role} />
          </Field>
          <Field label="Reporting currency">
            <input readOnly value="USD — US Dollar" />
          </Field>
          <button className="primary">Save changes</button>
        </form>
      </Panel>
      <Panel
        title="Connections & privacy"
        subtitle="A transparent view of your environment"
      >
        <dl className="detail-list">
          <dt>Storage</dt>
          <dd>
            {configured
              ? "Supabase workspace · RLS protected"
              : "Browser local storage · this device only"}
          </dd>
          <dt>Authentication</dt>
          <dd>
            {configured ? "Supabase Auth" : "Demo access · no account required"}
          </dd>
          <dt>AI generation</dt>
          <dd>
            Server-side OpenAI when configured; labeled templates otherwise
          </dd>
          <dt>Python service</dt>
          <dd>
            {process.env.NEXT_PUBLIC_BACKEND_URL
              ? "Configured"
              : "Not connected"}
          </dd>
          <dt>Live delivery</dt>
          <dd>Not configured</dd>
        </dl>
        <div className="button-row">
          <button
            className="secondary"
            onClick={() => exportFile("marketinggen-workspace.json", store)}
          >
            <Download size={15} /> Export workspace
          </button>
          <button
            className="secondary danger"
            onClick={() => {
              if (
                confirm("Delete all workspace records? This cannot be undone.")
              ) {
                save({
                  ...store,
                  customers: [],
                  products: [],
                  campaigns: [],
                  content: [],
                  tests: [],
                  predictions: [],
                  imports: [],
                });
                notify("Workspace records cleared");
              }
            }}
          >
            Clear workspace data
          </button>
        </div>
      </Panel>
    </div>
  );
  if (!authReady || !ready)
    return (
      <div className="loading-screen">
        <Sparkles className="spin" />
        <h2>Preparing your workspace…</h2>
      </div>
    );
  if (path.startsWith("/auth") || (configured && !user))
    return <Auth onDemo={() => go("/")} notify={notify} toast={toast} />;
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <button className="brand" onClick={() => go("/")}>
          <span className="brand-symbol">
            <Sparkles size={23} />
          </span>
          <span>
            MarketingGen<span className="brand-ai">AI</span>
          </span>
        </button>
        <button className="workspace-switch" onClick={() => go("/settings")}>
          <span className="workspace-avatar">
            {store.settings.business.slice(0, 1)}
          </span>
          <span>
            <strong>{store.settings.business}</strong>
            <small>{configured ? "Your workspace" : "Demo workspace"}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav>
          {nav.map((n) => (
            <div key={n.path}>
              {n.group && <div className="nav-group">{n.group}</div>}
              <button
                title={n.label}
                className={`nav-item ${path === n.path ? "selected" : ""}`}
                onClick={() => go(n.path)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {n.path === "/recommendations" && <b>3</b>}
                {n.path === "/content" && <span className="nav-new">AI</span>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <span>
              <Sparkles size={17} /> Built for your next big idea
            </span>
            <p>
              Less busywork.
              <br />
              More meaningful marketing.
            </p>
            <button onClick={() => go("/content")}>
              Create something great <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className="user-profile"
            onClick={() =>
              configured ? supabase!.auth.signOut() : go("/settings")
            }
          >
            <span className="user-avatar">AM</span>
            <span>
              <strong>{store.settings.name}</strong>
              <small>{user ?? "Demo workspace"}</small>
            </span>
            {configured ? (
              <LogOut size={16} />
            ) : (
              <ChevronsLeft
                size={16}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(!collapsed);
                }}
              />
            )}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="inline">
            <button
              className="mobile-toggle icon-button"
              onClick={() => setMobile(!mobile)}
              title="Toggle navigation"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} /> <strong>{title}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="Search workspace"
                placeholder="Search your workspace…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>
            <span className="topbar-divider" />
            <button
              className="notification-button"
              title="Notifications"
              onClick={() => setModal("notifications")}
            >
              <Bell size={19} />
              <i />
            </button>
            <button className="top-avatar" onClick={() => go("/settings")}>
              AM
            </button>
          </div>
        </header>
        <main>
          <div className="demo-banner">
            <span>
              <span className="dot" />
              {store.demoData
                ? "DEMO DATA"
                : configured
                  ? "CONNECTED WORKSPACE"
                  : "LOCAL WORKSPACE"}
            </span>
            <p>
              {configured
                ? store.demoData
                  ? "Sample data saved in your Supabase workspace. No campaigns are delivered."
                  : "Organization data protected by Supabase row-level security."
                : "Explore with sample data. Changes are saved in this browser. No campaigns are delivered."}
            </p>
            <button onClick={() => go("/settings")}>
              Workspace details <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {path === "/"
                  ? "A LITTLE CLARITY. A LOT OF GROWTH."
                  : path === "/content"
                    ? "WORDS THAT MAKE A DIFFERENCE."
                    : "YOUR NEXT CHAPTER STARTS HERE."}
              </div>
              <h1>
                {path === "/"
                  ? `Good things are growing, ${store.settings.name.split(" ")[0]}.`
                  : title}
                {path === "/" && <span className="greeting-dot">✦</span>}
              </h1>
              <p>
                {path === "/"
                  ? "Here’s the story your marketing is telling. Let’s make the next chapter even better."
                  : ((
                      {
                        "/campaigns":
                          "From your first spark to your next big campaign.",
                        "/content":
                          "Thoughtful content. The right audience. A message that matters.",
                        "/customers":
                          "Build relationships beyond the transaction.",
                        "/segments":
                          "Find the patterns. Understand the people.",
                        "/analytics":
                          "Turn your marketing numbers into your next move.",
                      } as Record<string, string>
                    )[path] ??
                    "Everything you need to turn customer understanding into meaningful growth.")}
              </p>
            </div>
            <div className="heading-actions">
              {["/", "/analytics", "/campaigns"].includes(path) && (
                <button
                  className="secondary"
                  onClick={() =>
                    exportFile("marketing-report.csv", filtered, true)
                  }
                >
                  <ArrowDownToLine size={15} /> Export report
                </button>
              )}
              {["/", "/campaigns", "/calendar"].includes(path) && (
                <button className="primary" onClick={() => open("campaign")}>
                  <Plus size={17} /> Create campaign
                </button>
              )}
              {["/customers", "/audience"].includes(path) && (
                <button className="primary" onClick={() => open("customer")}>
                  <Plus size={16} /> Add customer
                </button>
              )}
              {path === "/products" && (
                <button className="primary" onClick={() => open("product")}>
                  <Plus size={16} /> Add product
                </button>
              )}
              {path === "/ab-testing" && (
                <button className="primary" onClick={() => setModal("ab")}>
                  <Plus size={16} /> New A/B test
                </button>
              )}
            </div>
          </div>
          {["/", "/analytics", "/campaigns"].includes(path) && (
            <div className="filterbar">
              <div className="inline">
                <span className="live-indicator" />
                <strong>
                  {path === "/" ? "Performance snapshot" : "Campaign workspace"}
                </strong>
                <span className="muted small">
                  {store.demoData ? "Sample data" : "Workspace data"}
                </span>
              </div>
              <div className="button-row">
                <select
                  aria-label="Channel filter"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {[
                    "All channels",
                    "Email",
                    "Instagram",
                    "Google Ads",
                    "Facebook",
                    "WhatsApp",
                    "SMS",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <div className="select-icon">
                  <CalendarDays size={14} />
                  <select
                    aria-label="Date filter"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    {["All time", "Last 30 days", "Last 7 days"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="page-content"
          >
            {path === "/" ? (
              overview
            ) : path === "/campaigns" ? (
              <Panel
                title="All campaigns"
                subtitle="Plan, personalize, and keep every campaign moving"
              >
                {campaignTable(
                  filtered.filter((c) =>
                    (c.name + c.audience).toLowerCase().includes(query),
                  ),
                )}
              </Panel>
            ) : path === "/customers" || path === "/audience" ? (
              customersPage
            ) : path === "/products" ? (
              productsPage
            ) : path === "/segments" ? (
              segmentPage
            ) : path === "/content" ? (
              contentPage
            ) : path === "/predictions" ? (
              predictionPage
            ) : path === "/ab-testing" ? (
              abPage
            ) : path === "/channels" ? (
              channelsPage
            ) : path === "/analytics" ? (
              analyticsPage
            ) : path === "/calendar" ? (
              calendarPage
            ) : path === "/import" ? (
              importPage
            ) : path === "/settings" ? (
              settingsPage
            ) : path === "/recommendations" ? (
              <>
                <div className="notice">
                  <Sparkles size={18} />
                  <span>
                    These recommendations use your current customer and campaign
                    values. Suggested impacts are hypotheses to test; budgets
                    and delivery are never changed automatically.
                  </span>
                </div>
                <div className="recommendation-grid">
                  {recs.map((r, i) => (
                    <Panel key={r.title} title={r.title} subtitle={r.type}>
                      <p className="panel-copy">{r.detail}</p>
                      <button
                        className="primary"
                        onClick={() =>
                          i === 1 ? go("/ab-testing") : open("campaign")
                        }
                      >
                        {r.action}
                        <ArrowRight size={15} />
                      </button>
                    </Panel>
                  ))}
                </div>
                <Panel
                  title="Agentic marketing workflow"
                  subtitle="Connect the Python LangGraph service to orchestrate eight specialized nodes"
                >
                  <div className="workflow">
                    {[
                      "Research",
                      "Customer intelligence",
                      "Segmentation",
                      "Strategy",
                      "Content",
                      "Prediction",
                      "Optimization",
                      "Supervisor approval",
                    ].map((x, i) => (
                      <div key={x}>
                        <span>{i + 1}</span>
                        <strong>{x}</strong>
                        <small>
                          {process.env.NEXT_PUBLIC_BACKEND_URL
                            ? "Backend configured"
                            : "Backend required"}
                        </small>
                      </div>
                    ))}
                  </div>
                  <button
                    className="secondary"
                    onClick={async () => {
                      const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
                      if (!backend) {
                        notify(
                          "Deploy the Python service and set NEXT_PUBLIC_BACKEND_URL to run the LangGraph workflow.",
                        );
                        return;
                      }
                      setBusy(true);
                      try {
                        const session = (await supabase?.auth.getSession())
                          ?.data.session;
                        const r = await fetch(backend + "/api/agents/run", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...(session
                              ? {
                                  Authorization: `Bearer ${session.access_token}`,
                                }
                              : {}),
                          },
                          body: JSON.stringify({
                            business: store.settings.business,
                            product: store.products[0]?.name || "Your product",
                            customers: store.customers,
                            campaigns: store.campaigns,
                            approved: false,
                          }),
                        });
                        const d = await r.json();
                        if (!r.ok)
                          throw new Error(d.detail || "Workflow failed");
                        exportFile("agent-workflow-result.json", d);
                        notify(
                          "Workflow completed. Output downloaded; human approval required before delivery.",
                        );
                      } catch (e) {
                        notify(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    {busy ? "Running agents…" : "Run marketing workflow"}{" "}
                    <ArrowRight size={15} />
                  </button>
                </Panel>
              </>
            ) : (
              <Empty text="This page could not be found." />
            )}
          </motion.div>
          <footer>
            <span>Made for meaningful connections.</span>
            <span>
              MarketingGen AI <span className="footer-dot">·</span>{" "}
              {configured ? "Connected workspace" : "Demo environment"}{" "}
              <ShieldCheck size={13} />
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div
            className={`modal ${modal === "campaign" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">MAKE YOUR NEXT MOVE</span>
                <h2>
                  {modal.startsWith("integration:")
                    ? modal.split(":")[1] + " setup"
                    : modal === "notifications"
                      ? "Your workspace activity"
                      : modal === "ab"
                        ? "Create an A/B test"
                        : `${editing ? "Edit" : "Create"} ${modal}`}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={21} />
              </button>
            </div>
            {["campaign", "customer", "product"].includes(modal) && (
              <form
                className="stack"
                onSubmit={form.handleSubmit(submitRecord)}
              >
                <div className="form-grid">
                  <Field
                    label={
                      modal === "customer"
                        ? "Customer name"
                        : modal === "product"
                          ? "Product name"
                          : "Campaign name"
                    }
                  >
                    <input
                      {...form.register("name", { required: true })}
                      required
                      placeholder="Give it a meaningful name"
                    />
                  </Field>
                  {modal === "customer" ? (
                    <>
                      <Field label="Email">
                        <input
                          {...form.register("email")}
                          required
                          type="email"
                        />
                      </Field>
                      <Field label="Location">
                        <input {...form.register("location")} />
                      </Field>
                      <Field label="Age group">
                        <select {...form.register("age")}>
                          {["18–24", "25–34", "35–44", "45–54", "55+"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </Field>
                      <Field label="Interests">
                        <input {...form.register("interests")} />
                      </Field>
                      <Field label="Segment">
                        <select {...form.register("segment")}>
                          {Array.from(
                            new Set([
                              ...segmentNames,
                              ...store.customers.map((c) => c.segment),
                            ]),
                          ).map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </Field>
                      {[
                        ["spending", "Total spending"],
                        ["purchases", "Purchase count"],
                        ["visits", "Website visits"],
                        ["engagement", "Engagement score (0–100)"],
                        ["recency", "Days since last purchase"],
                      ].map(([k, v]) => (
                        <Field label={v} key={k}>
                          <input
                            type="number"
                            min="0"
                            max={k === "engagement" ? 100 : undefined}
                            {...form.register(k)}
                          />
                        </Field>
                      ))}
                      <Field label="Marketing consent">
                        <select
                          {...form.register("consent")}
                          defaultValue="false"
                        >
                          <option value="false">Opted out</option>
                          <option value="true">
                            Opted in (permission obtained)
                          </option>
                        </select>
                      </Field>
                    </>
                  ) : modal === "product" ? (
                    <>
                      <Field label="Category">
                        <input {...form.register("category")} required />
                      </Field>
                      <Field label="Price (USD)">
                        <input
                          type="number"
                          min="0"
                          step=".01"
                          {...form.register("price")}
                          required
                        />
                      </Field>
                      <Field label="Discount (%)">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          {...form.register("discount")}
                        />
                      </Field>
                      <Field label="Target audience">
                        <input {...form.register("audience")} />
                      </Field>
                      <Field label="Product URL">
                        <input type="url" {...form.register("url")} />
                      </Field>
                      <div className="full-width">
                        <Field label="Description">
                          <textarea
                            {...form.register("description")}
                            rows={4}
                          />
                        </Field>
                      </div>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={async () => {
                          const result = await generate(
                            form.getValues(),
                            "product",
                          );
                          if (result) form.setValue("description", result);
                        }}
                      >
                        <Sparkles size={15} /> Generate description
                      </button>
                    </>
                  ) : (
                    <>
                      <Field label="Business name">
                        <input
                          {...form.register("business")}
                          defaultValue={store.settings.business}
                        />
                      </Field>
                      <Field label="Product">
                        <input
                          {...form.register("product")}
                          list="products"
                          required
                        />
                        <datalist id="products">
                          {store.products.map((p) => (
                            <option key={p.id} value={p.name} />
                          ))}
                        </datalist>
                      </Field>
                      <Field label="Target audience">
                        <input
                          {...form.register("audience")}
                          list="audiences"
                          required
                        />
                        <datalist id="audiences">
                          {segments.map((s) => (
                            <option key={s.name} value={s.name} />
                          ))}
                        </datalist>
                      </Field>
                      <Field label="Marketing objective">
                        <select {...form.register("objective")}>
                          {[
                            "Increase Sales",
                            "Generate Leads",
                            "Increase Website Traffic",
                            "Improve Brand Awareness",
                            "Promote New Products",
                            "Retain Existing Customers",
                            "Recover Abandoned Carts",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Channel">
                        <select {...form.register("channel")}>
                          {[
                            "Email",
                            "Instagram",
                            "Google Ads",
                            "Facebook",
                            "WhatsApp",
                            "SMS",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Budget (USD)">
                        <input
                          type="number"
                          min="0"
                          {...form.register("budget")}
                          required
                        />
                      </Field>
                      <Field label="Brand tone">
                        <select {...form.register("tone")}>
                          {[
                            "Friendly",
                            "Professional",
                            "Luxury",
                            "Creative",
                            "Persuasive",
                            "Urgent",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Start date">
                        <input
                          type="date"
                          {...form.register("start")}
                          required
                        />
                      </Field>
                      <Field label="End date">
                        <input type="date" {...form.register("end")} required />
                      </Field>
                      <Field label="Planning status">
                        <select {...form.register("status")}>
                          {[
                            "Draft",
                            "Pending Approval",
                            "Scheduled",
                            "Active",
                            "Paused",
                            "Completed",
                            "Failed",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Language">
                        <select {...form.register("language")}>
                          {["English", "Hindi", "Telugu", "Spanish"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </Field>
                      <div className="full-width">
                        <Field label="Product description, offer, and campaign context">
                          <textarea
                            {...form.register("description")}
                            rows={3}
                            placeholder="What should your audience know?"
                          />
                        </Field>
                      </div>
                    </>
                  )}
                </div>
                {modal === "campaign" && (
                  <>
                    <div className="button-row">
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => generate(form.getValues())}
                      >
                        <Sparkles size={15} />
                        {busy ? "Generating…" : "Generate strategy & copy"}
                      </button>
                      {generationMode && (
                        <span className="tag">
                          {generationMode === "demo"
                            ? "Demo template"
                            : "OpenAI generated"}
                        </span>
                      )}
                    </div>
                    <div className="notice">
                      Optional recorded results: enter verified campaign totals.
                      New plans start at zero; values are never collected from
                      disconnected channels.
                    </div>
                    <div className="form-grid">
                      {[
                        ["impressions", "Recorded impressions"],
                        ["clicks", "Recorded clicks"],
                        ["conversions", "Recorded conversions"],
                        ["revenue", "Recorded revenue (USD)"],
                      ].map(([k, v]) => (
                        <Field key={k} label={v}>
                          <input
                            type="number"
                            min="0"
                            step={k === "revenue" ? ".01" : "1"}
                            {...form.register(k)}
                          />
                        </Field>
                      ))}
                    </div>
                    <Field label="Campaign strategy & copy">
                      <textarea
                        rows={8}
                        value={generated || form.watch("content") || ""}
                        onChange={(e) => {
                          setGenerated(e.target.value);
                          form.setValue("content", e.target.value);
                        }}
                      />
                    </Field>
                  </>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="primary">
                    <Check size={16} /> Save {modal}
                  </button>
                </div>
              </form>
            )}
            {modal === "ab" && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  const t: ABTest = {
                    id: uid(),
                    name: String(f.name),
                    a: String(f.a),
                    b: String(f.b),
                    visitorsA: Number(f.visitorsA),
                    visitorsB: Number(f.visitorsB),
                    conversionsA: Number(f.conversionsA),
                    conversionsB: Number(f.conversionsB),
                  };
                  if (
                    t.conversionsA > t.visitorsA ||
                    t.conversionsB > t.visitorsB
                  ) {
                    notify("Conversions cannot exceed visitors");
                    return;
                  }
                  save({ ...store, tests: [t, ...store.tests] });
                  setModal(null);
                  notify("Test saved");
                }}
              >
                <Field label="Test name">
                  <input name="name" required />
                </Field>
                <div className="form-grid">
                  {["A", "B"].map((v) => (
                    <div className="stack" key={v}>
                      <Field label={`Variation ${v}`}>
                        <textarea name={v.toLowerCase()} required />
                      </Field>
                      <Field label="Visitors">
                        <input
                          name={"visitors" + v}
                          type="number"
                          min="1"
                          required
                        />
                      </Field>
                      <Field label="Conversions">
                        <input
                          name={"conversions" + v}
                          type="number"
                          min="0"
                          required
                        />
                      </Field>
                    </div>
                  ))}
                </div>
                <button className="primary">Save & compare variations</button>
              </form>
            )}
            {modal.startsWith("integration:") && (
              <div className="stack">
                <div className="notice">
                  <ShieldCheck size={18} />
                  <span>
                    No credentials are stored or collected in this setup screen.
                  </span>
                </div>
                <ol className="setup-steps">
                  <li>
                    Create an application in the provider’s official developer
                    console.
                  </li>
                  <li>
                    Complete business verification and request the minimum
                    marketing permissions.
                  </li>
                  <li>
                    Store OAuth client credentials and refresh tokens in your
                    backend secret manager.
                  </li>
                  <li>
                    Implement OAuth callback validation, signed webhooks,
                    consent checks, and unsubscribe handling.
                  </li>
                  <li>
                    Test with a sandbox audience before enabling any live
                    delivery.
                  </li>
                </ol>
                <p className="muted">
                  Provider delivery adapters require implementation and
                  credentials. The current release supports planning and
                  exporting campaigns.
                </p>
              </div>
            )}
            {modal === "notifications" && (
              <div className="stack">
                <div className="history-row">
                  <Check size={19} />
                  <span>
                    Your workspace is ready. {store.campaigns.length} campaign
                    plans available.
                  </span>
                </div>
                <div className="history-row">
                  <CalendarDays size={19} />
                  <span>
                    {
                      store.campaigns.filter((c) => c.status === "Scheduled")
                        .length
                    }{" "}
                    campaigns have a planned schedule. No automatic delivery is
                    enabled.
                  </span>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setModal(null);
                    go("/calendar");
                  }}
                >
                  Open campaign calendar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Auth({
  onDemo,
  notify,
  toast,
}: {
  onDemo: () => void;
  notify: (s: string) => void;
  toast: string;
}) {
  const [mode, setMode] = useState(
      typeof window !== "undefined" &&
        window.location.pathname === "/auth/reset"
        ? "reset"
        : "login",
    ),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-story">
        <span className="brand">
          <span className="brand-symbol">
            <Sparkles />
          </span>
          MarketingGen AI
        </span>
        <div>
          <span className="eyebrow">
            THOUGHTFUL MARKETING. MEANINGFUL GROWTH.
          </span>
          <h1>
            Your next great
            <br />
            growth story
            <br />
            starts here.
          </h1>
          <p>
            Understand your audience. Find the right words.
            <br />
            Create campaigns that connect.
          </p>
        </div>
        <small>Built for meaningful connections.</small>
      </div>
      <div className="auth-form">
        <span className="tag">
          <ShieldCheck size={14} /> Secure workspace
        </span>
        <h1>
          {mode === "signup"
            ? "Make room for growth."
            : mode === "forgot"
              ? "Let’s get you back in."
              : mode === "reset"
                ? "A fresh start."
                : "Welcome back."}
        </h1>
        <p>
          {mode === "signup"
            ? "Create your account and start your next chapter."
            : "Your marketing workspace is ready when you are."}
        </p>
        {!configured && (
          <div className="notice">
            Supabase is not configured. Explore the demo workspace without an
            account.
          </div>
        )}
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) {
              notify(
                "Configure Supabase environment variables to enable authentication.",
              );
              return;
            }
            setBusy(true);
            const f = new FormData(e.currentTarget),
              email = String(f.get("email")),
              password = String(f.get("password"));
            try {
              const result =
                mode === "signup"
                  ? await supabase.auth.signUp({
                      email,
                      password,
                      options: {
                        data: {
                          name: String(f.get("name")),
                          organization: String(f.get("organization")),
                        },
                        emailRedirectTo: location.origin,
                      },
                    })
                  : mode === "forgot"
                    ? await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: location.origin + "/auth/reset",
                      })
                    : mode === "reset"
                      ? await supabase.auth.updateUser({ password })
                      : await supabase.auth.signInWithPassword({
                          email,
                          password,
                        });
              if (result.error) throw result.error;
              notify(
                mode === "forgot"
                  ? "Check your email for a password reset link."
                  : mode === "signup"
                    ? "Account created. Check your email to confirm your account."
                    : "Success",
              );
              if (mode === "login" || mode === "reset") location.href = "/";
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Authentication failed",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "signup" && (
            <>
              <Field label="Your name">
                <input name="name" required />
              </Field>
              <Field label="Organization">
                <input name="organization" required />
              </Field>
            </>
          )}
          {mode !== "reset" && (
            <Field label="Email address">
              <input
                name="email"
                type="email"
                required
                placeholder="you@company.com"
              />
            </Field>
          )}
          {mode !== "forgot" && (
            <Field label="Password">
              <input
                name="password"
                type="password"
                minLength={8}
                required
                placeholder="At least 8 characters"
              />
            </Field>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Update password"
                    : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="button-row">
          <button
            className="text-button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </button>
          <button className="text-button" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
        </div>
        {!configured && (
          <button className="secondary" onClick={onDemo}>
            Explore demo workspace <ArrowRight size={15} />
          </button>
        )}
        {toast && (
          <p role="status" className="auth-message">
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}
