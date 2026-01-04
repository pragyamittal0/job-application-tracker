import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, Download, Filter, Plus, Search, Trash2, Upload, MoreHorizontal } from "lucide-react";

// ------------------------------------------------------------
// Job Application Tracker (single-file React app)
// - Stores data in localStorage (no backend)
// - Track: company, role, date applied, status, referral, referrer,
//          who you messaged, where (LinkedIn/email), notes, link
// - Filter, sort, export/import JSON, CSV export
// ------------------------------------------------------------

const STORAGE_KEY = "pragya_job_tracker_v1";

const STATUS_OPTIONS = [
  "Applied",
  "Referral Submitted",
  "Recruiter Reached Out",
  "Phone Screen",
  "Technical Round",
  "Final Round",
  "Offer",
  "Rejected",
  "On Hold",
];

function uid() {
  // reasonably unique id for local use
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatDateInput(d) {
  // d: Date -> yyyy-mm-dd
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeParseJSON(text) {
  try {
    const obj = JSON.parse(text);
    return { ok: true, value: obj };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function toCSV(rows) {
  const header = [
    "date_applied",
    "company",
    "role",
    "status",
    "referral",
    "referrer_name",
    "referrer_contact",
    "messaged_whom",
    "messaged_where",
    "job_link",
    "notes",
    "last_updated",
  ];

  const esc = (v) => {
    const s = String(v ?? "");
    // quote if contains comma, newline, or quote
    if (/[\n\r,\"]/g.test(s)) {
      return `"${s.replace(/\"/g, '""')}"`;
    }
    return s;
  };

  const lines = [header.join(",")];
  for (const r of rows) {
    const line = header
      .map((k) => {
        if (k === "referral") return esc(r.referral ? "Yes" : "No");
        return esc(r[k]);
      })
      .join(",");
    lines.push(line);
  }
  return lines.join("\n");
}

function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParseJSON(raw);
  if (!parsed.ok) return [];
  if (!Array.isArray(parsed.value)) return [];
  return parsed.value;
}

function saveToStorage(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function StatPill({ label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = useMemo(() => {
    const s = (status || "").toLowerCase();
    if (s.includes("offer")) return "bg-black text-white";
    if (s.includes("final")) return "bg-zinc-900 text-white";
    if (s.includes("technical") || s.includes("phone") || s.includes("screen"))
      return "bg-zinc-100 text-zinc-900";
    if (s.includes("rejected")) return "bg-zinc-50 text-zinc-500";
    if (s.includes("on hold")) return "bg-zinc-50 text-zinc-700";
    if (s.includes("recruiter")) return "bg-zinc-100 text-zinc-900";
    if (s.includes("referral")) return "bg-zinc-100 text-zinc-900";
    return "bg-zinc-100 text-zinc-900";
  }, [status]);

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
      {status || "Applied"}
    </span>
  );
}

function AppRowActions({ onEdit, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-red-600">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ApplicationForm({ initial, onCancel, onSave }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => {
    const today = formatDateInput(new Date());
    return {
      id: initial?.id ?? uid(),
      date_applied: initial?.date_applied ?? today,
      company: initial?.company ?? "",
      role: initial?.role ?? "",
      status: initial?.status ?? "Applied",
      referral: initial?.referral ?? false,
      referrer_name: initial?.referrer_name ?? "",
      referrer_contact: initial?.referrer_contact ?? "", // LinkedIn URL or email
      messaged_whom: initial?.messaged_whom ?? "", // recruiter/HM/team member name
      messaged_where: initial?.messaged_where ?? "", // LinkedIn/email
      job_link: initial?.job_link ?? "",
      notes: initial?.notes ?? "",
      last_updated: initial?.last_updated ?? new Date().toISOString(),
    };
  });

  const [error, setError] = useState("");

  const update = (k, v) => {
    setForm((p) => ({ ...p, [k]: v, last_updated: new Date().toISOString() }));
  };

  const validate = () => {
    if (!form.company.trim()) return "Company is required.";
    if (!form.role.trim()) return "Role title is required.";
    if (!form.date_applied) return "Date applied is required.";
    return "";
  };

  const submit = () => {
    const e = validate();
    if (e) {
      setError(e);
      return;
    }
    setError("");
    onSave({ ...form });
  };

  return (
    <div className="grid gap-4">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Date applied</Label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              type="date"
              value={form.date_applied}
              onChange={(e) => update("date_applied", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => update("status", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Company</Label>
          <Input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="e.g., Adobe" />
        </div>

        <div className="grid gap-2">
          <Label>Role title</Label>
          <Input value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="e.g., Data Engineer II" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Job link</Label>
          <Input value={form.job_link} onChange={(e) => update("job_link", e.target.value)} placeholder="Posting URL" />
        </div>
        <div className="grid gap-2">
          <Label>Where did you message?</Label>
          <Input
            value={form.messaged_where}
            onChange={(e) => update("messaged_where", e.target.value)}
            placeholder="LinkedIn, Email, etc."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Who did you message?</Label>
          <Input
            value={form.messaged_whom}
            onChange={(e) => update("messaged_whom", e.target.value)}
            placeholder="Recruiter / Hiring Manager / Team member"
          />
        </div>

        <div className="grid gap-2">
          <Label>Referral</Label>
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <input
              type="checkbox"
              checked={form.referral}
              onChange={(e) => update("referral", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">I have a referral for this application</span>
          </div>
        </div>
      </div>

      {form.referral ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Referrer name</Label>
            <Input
              value={form.referrer_name}
              onChange={(e) => update("referrer_name", e.target.value)}
              placeholder="Name of referrer"
            />
          </div>
          <div className="grid gap-2">
            <Label>Referrer contact (LinkedIn / email)</Label>
            <Input
              value={form.referrer_contact}
              onChange={(e) => update("referrer_contact", e.target.value)}
              placeholder="LinkedIn URL or email"
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Interview steps, follow-up reminders, details about the conversation, etc."
          rows={4}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit}>{isEdit ? "Save changes" : "Add application"}</Button>
      </div>
    </div>
  );
}

export default function JobApplicationTracker() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [referralFilter, setReferralFilter] = useState("all");
  const [sortKey, setSortKey] = useState("date_desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    setRows(loadFromStorage());
  }, []);

  useEffect(() => {
    saveToStorage(rows);
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const referrals = rows.filter((r) => r.referral).length;
    const interviews = rows.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return s.includes("screen") || s.includes("technical") || s.includes("final");
    }).length;
    const offers = rows.filter((r) => (r.status || "").toLowerCase().includes("offer")).length;

    const last7 = (() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return rows.filter((r) => {
        const d = new Date(r.date_applied);
        return !Number.isNaN(d.getTime()) && d >= cutoff;
      }).length;
    })();

    return { total, referrals, interviews, offers, last7 };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let data = [...rows];

    if (q) {
      data = data.filter((r) => {
        return (
          (r.company || "").toLowerCase().includes(q) ||
          (r.role || "").toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q) ||
          (r.messaged_whom || "").toLowerCase().includes(q) ||
          (r.referrer_name || "").toLowerCase().includes(q)
        );
      });
    }

    if (statusFilter !== "all") {
      data = data.filter((r) => (r.status || "Applied") === statusFilter);
    }

    if (referralFilter !== "all") {
      const want = referralFilter === "yes";
      data = data.filter((r) => Boolean(r.referral) === want);
    }

    const byDate = (a, b) => {
      const da = new Date(a.date_applied).getTime();
      const db = new Date(b.date_applied).getTime();
      return da - db;
    };

    switch (sortKey) {
      case "date_asc":
        data.sort(byDate);
        break;
      case "company_asc":
        data.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
        break;
      case "status_asc":
        data.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
        break;
      case "date_desc":
      default:
        data.sort((a, b) => -byDate(a, b));
        break;
    }

    return data;
  }, [rows, query, statusFilter, referralFilter, sortKey]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const removeRow = (id) => {
    setRows((p) => p.filter((r) => r.id !== id));
  };

  const saveRow = (row) => {
    setRows((p) => {
      const idx = p.findIndex((x) => x.id === row.id);
      if (idx >= 0) {
        const next = [...p];
        next[idx] = row;
        return next;
      }
      return [row, ...p];
    });
    setDialogOpen(false);
  };

  const exportJSON = () => {
    downloadText(`job_applications_${formatDateInput(new Date())}.json`, JSON.stringify(rows, null, 2), "application/json");
  };

  const exportCSV = () => {
    downloadText(`job_applications_${formatDateInput(new Date())}.csv`, toCSV(rows), "text/csv");
  };

  const clearAll = () => {
    if (!confirm("This will delete all your applications from this browser. Continue?")) return;
    setRows([]);
  };

  const importJSON = async (file) => {
    const text = await file.text();
    const parsed = safeParseJSON(text);
    if (!parsed.ok) {
      alert("Invalid JSON file.");
      return;
    }
    if (!Array.isArray(parsed.value)) {
      alert("JSON must be an array of application rows.");
      return;
    }
    // Basic normalization
    const normalized = parsed.value
      .filter(Boolean)
      .map((r) => ({
        id: r.id ?? uid(),
        date_applied: r.date_applied ?? formatDateInput(new Date()),
        company: r.company ?? "",
        role: r.role ?? "",
        status: r.status ?? "Applied",
        referral: Boolean(r.referral),
        referrer_name: r.referrer_name ?? "",
        referrer_contact: r.referrer_contact ?? "",
        messaged_whom: r.messaged_whom ?? "",
        messaged_where: r.messaged_where ?? "",
        job_link: r.job_link ?? "",
        notes: r.notes ?? "",
        last_updated: r.last_updated ?? new Date().toISOString(),
      }));

    setRows(normalized);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Job Application Tracker</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track where you applied, role names, referrals, and who you messaged — stored locally in your browser.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew} className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-white text-black border border-gray-200 shadow-xl rounded-2xl">

                  <DialogHeader>
                    <DialogTitle>{editing ? "Edit application" : "Add application"}</DialogTitle>
                    <DialogDescription>
                      Capture the essentials: company, role, referral, and your outreach.
                    </DialogDescription>
                  </DialogHeader>
                  <ApplicationForm initial={editing} onCancel={() => setDialogOpen(false)} onSave={saveRow} />
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Export</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={exportJSON}>Export JSON</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCSV}>Export CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm hover:bg-zinc-50">
                <Upload className="h-4 w-4" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    importJSON(f);
                    e.target.value = "";
                  }}
                />
              </label>

              <Button variant="ghost" className="gap-2 text-red-600 hover:text-red-700" onClick={clearAll}>
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatPill label="Total" value={stats.total} />
            <StatPill label="Last 7 days" value={stats.last7} />
            <StatPill label="Referrals" value={stats.referrals} />
            <StatPill label="Interviews" value={stats.interviews} />
            <StatPill label="Offers" value={stats.offers} />
          </div>
        </motion.div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Applications</CardTitle>
                <CardDescription>Search, filter, and keep daily notes.</CardDescription>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="w-full pl-10 md:w-72"
                    placeholder="Search company, role, notes, people..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={referralFilter} onValueChange={setReferralFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Referral" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Referral</SelectItem>
                      <SelectItem value="no">No referral</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortKey} onValueChange={setSortKey}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Date (newest)</SelectItem>
                      <SelectItem value="date_asc">Date (oldest)</SelectItem>
                      <SelectItem value="company_asc">Company (A→Z)</SelectItem>
                      <SelectItem value="status_asc">Status (A→Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filtered.length === 0 ? (
              <div className="rounded-2xl border bg-white p-8 text-center">
                <p className="text-sm text-muted-foreground">No applications yet. Add your first one.</p>
                <div className="mt-4">
                  <Button onClick={openNew} className="gap-2">
                    <Plus className="h-4 w-4" /> Add application
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((r) => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold">{r.company}</h3>
                            <Badge variant="outline" className="rounded-full">{r.date_applied}</Badge>
                            <StatusBadge status={r.status} />
                            {r.referral ? (
                              <Badge className="rounded-full" variant="secondary">Referral</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm font-medium text-zinc-800">{r.role}</p>

                          <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <div>
                              <span className="font-medium text-zinc-700">Messaged:</span> {r.messaged_whom || "—"}
                              {r.messaged_where ? ` (${r.messaged_where})` : ""}
                            </div>
                            <div>
                              <span className="font-medium text-zinc-700">Referrer:</span> {r.referrer_name || "—"}
                            </div>
                          </div>

                          {(r.job_link || r.notes) ? (
                            <div className="mt-3 grid gap-2">
                              {r.job_link ? (
                                <a
                                  href={r.job_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-medium text-zinc-900 underline underline-offset-4"
                                >
                                  Open job posting
                                </a>
                              ) : null}
                              {r.notes ? (
                                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.notes}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={() => openEdit(r)}>
                            Edit
                          </Button>
                          <AppRowActions onEdit={() => openEdit(r)} onDelete={() => removeRow(r.id)} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <Separator className="my-6" />

            <div className="text-xs text-muted-foreground">
              Tip: Export JSON weekly as a backup. This tracker stores data locally in your browser (localStorage).
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-sm text-muted-foreground">
          <div className="rounded-2xl border bg-white p-4">
            <p className="font-medium text-zinc-800">How to use this</p>
            <ul className="mt-2 list-disc pl-5">
              <li>Add one entry per application. Update status as you progress.</li>
              <li>Use “Referral” fields to track who referred you.</li>
              <li>Use “Messaged whom/where” to record outreach (recruiter, HM, team member).</li>
              <li>Export CSV for sharing and JSON for backups/imports.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
