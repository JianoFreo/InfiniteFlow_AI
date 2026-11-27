import { Menu } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import ConfirmDialog from "../components/ConfirmDialog";
import AccountMenu from "../components/AccountMenu";
import AuthModal from "../components/AuthModal";
import type { AuthMode } from "../components/AuthModal";
import PlansModal from "../components/PlansModal";
import SettingsModal from "../components/SettingsModal";
import UsageMeter from "../components/UsageMeter";
import type { SettingsTab } from "../components/SettingsModal";
import SideBar from "../components/SideBar";
import SpaceBackground from "../components/SpaceBackground";
import Toast from "../components/Toast";
import type { ToastMessage } from "../components/Toast";
import type { UploadProgressInfo } from "../components/Upload/UploadForm";
import { isActive } from "../interface/Job";
import type { Job, JobChangeEvent, JobDetail, JobMode, PreprocessStep } from "../interface/Job";
import { LIMIT_CODES } from "../interface/Usage";
import { useAuth } from "../lib/auth";
import { api, errorCode, errorMessage } from "../lib/axios";
import { useSettings } from "../lib/settings";
import { useUsage } from "../lib/usage";
import { connectJobStream } from "../services/job-sse/connectJobStream";
import type { StreamState } from "../services/job-sse/connectJobStream";
import JobDetailsPage from "./JobDetailsPage";
import UploadPage from "./UploadPage";

type Page = "upload" | "job";
const DETAIL_REFRESH_MS = 1000;

/**
 * The shell (TechCare pattern): owns all page state and data loading, picks the page from ?page=,
 * renders SideBar + Header + the active page, and passes data down as props.
 */
const Studio = () => {
  const { user, owner, logout } = useAuth();
  const { settings, resolvedTheme } = useSettings();
  const { refresh: refreshUsage } = useUsage();
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  /** Null = closed. reason = the limit that was just hit, shown at the top of the dialog. */
  const [plans, setPlans] = useState<{ reason: string | null } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = searchParams.get("page") as Page | null;
  const jobId = Number(searchParams.get("id")) || null;
  const page: Page = rawPage === "job" && jobId ? "job" : "upload";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [selected, setSelected] = useState<JobDetail | null>(null);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const setCollapsedPersist = (value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem("sidebar-collapsed", value ? "1" : "0");
    } catch {
      // storage unavailable: the choice just won't persist
    }
  };
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Job | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Refs so the long-lived SSE callback always sees the current values
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const jobIdRef = useRef(jobId);
  jobIdRef.current = page === "job" ? jobId : null;
  const lastDetailLoad = useRef(0);
  const detailTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback((tone: ToastMessage["tone"], text: string) => setToast({ id: Date.now(), tone, text }), []);

  const openPlans = useCallback((reason?: string) => {
    setPlans({ reason: reason ?? null });
    setSidebarOpen(false);
  }, []);

  // Back from Stripe Checkout: ?billing=success|cancel. The webhook can take a few seconds, so poll briefly.
  // Runs once on mount (StrictMode's second run just repeats it; the cleanup stops the first poll).
  const billingParam = useRef(searchParams.get("billing"));
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  useEffect(() => {
    const result = billingParam.current;
    if (!result) return;
    setSearchParamsRef.current({ page: "upload" }, { replace: true });
    if (result === "cancel") {
      notify("bad", "Checkout cancelled. Nothing was charged.");
      return;
    }
    notify("ok", "Thanks for subscribing. Pro limits apply as soon as the payment is confirmed.");
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const usage = await refreshUsage();
      if (usage?.plan === "pro" || tries >= 10) {
        clearInterval(timer);
        if (usage?.plan === "pro") notify("ok", "You're on Pro now.");
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [notify, refreshUsage]);

  const loadJobs = useCallback(async () => {
    const { data } = await api.get<{ jobs: Job[] }>("/api/jobs", { params: { limit: 100 } });
    setJobs(data.jobs);
    setJobsLoaded(true);
  }, []);

  const loadJob = useCallback(async (id: number) => {
    lastDetailLoad.current = Date.now();
    try {
      const { data } = await api.get<{ job: JobDetail }>(`/api/jobs/${id}`);
      if (jobIdRef.current === id) {
        setSelected(data.job);
        setSelectedError(null);
      }
    } catch (err) {
      if (jobIdRef.current === id) setSelectedError(errorMessage(err, "Could not load this job"));
    }
  }, []);

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      loadJobs(),
      jobIdRef.current ? loadJob(jobIdRef.current) : Promise.resolve(),
    ]);
    if (results[0].status === "rejected") notify("bad", errorMessage(results[0].reason, "Could not load jobs"));
  }, [loadJobs, loadJob, notify]);

  /** Refetch the open job at most once a second while events stream in (keeps the chunk grid live). */
  const scheduleDetailRefresh = useCallback(
    (id: number, urgent: boolean) => {
      clearTimeout(detailTimer.current);
      const wait = urgent ? 0 : Math.max(0, DETAIL_REFRESH_MS - (Date.now() - lastDetailLoad.current));
      detailTimer.current = setTimeout(() => void loadJob(id), wait);
    },
    [loadJob],
  );

  const handleJobEvents = useCallback(
    (events: JobChangeEvent[]) => {
      const known = new Map(jobsRef.current.map((job) => [job.id, job]));
      let needFullReload = false;

      setJobs((prev) =>
        prev
          .filter((job) => !events.some((e) => e.id === job.id && e.status === "deleted"))
          .map((job) => {
            const event = events.find((e) => e.id === job.id);
            if (!event || event.status === "deleted") return job;
            return {
              ...job,
              status: event.status,
              progress: event.progress,
              chunks: { total: event.totalChunks, completed: event.completedChunks },
            };
          }),
      );

      for (const event of events) {
        const before = known.get(event.id);
        // New job (from another tab) or a status change that brings new data (output size, download URL)
        if (event.status !== "deleted" && (!before || before.status !== event.status)) needFullReload = true;

        if (event.id === jobIdRef.current) {
          if (event.status === "deleted") {
            setSelected(null);
            setSelectedError("This job was deleted.");
          } else {
            setSelected((prev) => (prev ? { ...prev, status: event.status as Job["status"], progress: event.progress } : prev));
            scheduleDetailRefresh(event.id, before?.status !== event.status);
          }
        }
      }
      if (needFullReload) {
        void loadJobs().catch(() => undefined);
        void refreshUsage(); // a new or failed job changes what is left today
      }
    },
    [loadJobs, scheduleDetailRefresh, refreshUsage],
  );

  const handleJobEventsRef = useRef(handleJobEvents);
  handleJobEventsRef.current = handleJobEvents;
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // One SSE connection for the whole app. Every (re)connect reloads from REST.
  useEffect(
    () =>
      connectJobStream({
        onStateChange: setStreamState,
        onLive: () => void loadDataRef.current(),
        onJobsChanged: (events) => handleJobEventsRef.current(events),
      }),
    [owner],
  );

  // Guest <-> account switch: the old history is not this person's anymore
  const firstOwner = useRef(owner);
  useEffect(() => {
    if (firstOwner.current === owner) return;
    firstOwner.current = owner;
    setJobs([]);
    setJobsLoaded(false);
    setSelected(null);
    setSearchParams({ page: "upload" });
  }, [owner, setSearchParams]);

  useEffect(() => {
    setSelected(null);
    setSelectedError(null);
    if (page === "job" && jobId) void loadJob(jobId);
  }, [page, jobId, loadJob]);

  const navigate = (next: Page, id?: number) => {
    setSearchParams(id ? { page: next, id: String(id) } : { page: next });
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  };

  const uploadJob = async (
    { file, factor, mode, preprocess }: { file: File; factor: number; mode: JobMode; preprocess: PreprocessStep[] },
    onProgress: (p: UploadProgressInfo) => void,
  ) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post<{ job: Job }>("/api/jobs", form, {
        params: { factor, mode, ...(preprocess.length ? { preprocess: preprocess.join(",") } : {}) },
        timeout: 0,
        onUploadProgress: (event) => onProgress({ loaded: event.loaded, total: event.total ?? file.size }),
      });
      setJobs((prev) => [data.job, ...prev.filter((job) => job.id !== data.job.id)]);
      notify("ok", `Started job #${data.job.id} (${data.job.chunks.total} chunks)`);
      void refreshUsage();
      navigate("job", data.job.id);
    } catch (err) {
      const code = errorCode(err);
      if (code && LIMIT_CODES.includes(code)) {
        void refreshUsage();
        openPlans(errorMessage(err));
      } else {
        notify("bad", errorMessage(err, "Upload failed"));
      }
      throw err;
    }
  };

  const cancelJob = async (id: number) => {
    setBusyId(id);
    try {
      const { data } = await api.patch<{ job: Job }>(`/api/jobs/${id}/cancel`);
      setJobs((prev) => prev.map((job) => (job.id === id ? data.job : job)));
      if (jobIdRef.current === id) void loadJob(id);
      notify("ok", `Job #${id} cancelled`);
    } catch (err) {
      notify("bad", errorMessage(err, "Could not cancel"));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setBusyId(id);
    try {
      await api.delete(`/api/jobs/${id}`);
      setJobs((prev) => prev.filter((job) => job.id !== id));
      notify("ok", `Job #${id} deleted`);
      if (jobIdRef.current === id) navigate("upload");
    } catch (err) {
      notify("bad", errorMessage(err, "Could not delete"));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  };

  return (
    <div className="relative flex min-h-full">
      {settings.starfield && resolvedTheme === "dark" && (
        <SpaceBackground intensity={1 + Math.min(7, jobs.filter(isActive).length * 2)} />
      )}
      <SideBar
        jobs={jobs}
        loaded={jobsLoaded}
        activeJobId={page === "job" ? jobId : null}
        onNewVideo={() => navigate("upload")}
        onOpenJob={(id) => navigate("job", id)}
        onDeleteJob={setPendingDelete}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        live={streamState === "live"}
        collapsed={collapsed}
        onCollapse={() => setCollapsedPersist(true)}
        footer={
          <>
            <UsageMeter onPlans={() => openPlans()} />
            <AccountMenu
              user={user}
              onSettings={(tab) => {
                setSettingsTab(tab);
                setSidebarOpen(false);
              }}
              onPlans={() => openPlans()}
              onLogin={() => setAuthMode("login")}
              onRegister={() => setAuthMode("register")}
              onLogout={() => {
                logout();
                notify("ok", "Logged out");
              }}
            />
          </>
        }
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <button
          className={`fixed left-3 top-3 z-20 rounded-lg bg-panel p-2 text-ink-dim hover:text-ink ${collapsed ? "" : "lg:hidden"}`}
          onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? setCollapsedPersist(false) : setSidebarOpen(true))}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6 lg:py-8">
          {page === "upload" && <UploadPage onUpload={uploadJob} onPlans={openPlans} />}
          {page === "job" && (
            <JobDetailsPage
              job={selected}
              error={jobId ? selectedError : "No job selected."}
              busy={busyId === jobId}
              onCancel={(id) => void cancelJob(id)}
              onDelete={setPendingDelete}
            />
          )}
        </main>
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        title={`Delete job #${pendingDelete?.id ?? ""}?`}
        message="This removes the job and both the uploaded and the generated video. It can't be undone."
        confirmLabel="Delete"
        busy={busyId === pendingDelete?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
      {settingsTab && (
        <SettingsModal
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={() => setSettingsTab(null)}
          onLogin={() => setAuthMode("login")}
          onRegister={() => setAuthMode("register")}
          onPlans={() => {
            setSettingsTab(null);
            openPlans();
          }}
        />
      )}
      {plans && (
        <PlansModal
          reason={plans.reason}
          onClose={() => setPlans(null)}
          onRegister={() => {
            setPlans(null);
            setAuthMode("register");
          }}
        />
      )}
      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthMode(null)}
          onDone={(message) => {
            setAuthMode(null);
            notify("ok", message);
          }}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Studio;
