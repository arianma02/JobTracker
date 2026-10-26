import { useEffect, useState } from "react";
import AddJobForm from "./AddJobForm";
import JobDetails from "./JobDetails";
import JobFilters from "./JobFilters";
import {
  emptyFilters,
  statusLabels,
  type JobFilterValues,
  type JobPage,
} from "./jobs";

type JobView = "jobs" | "applications";

export default function App() {
  const [view, setView] = useState<JobView>("jobs");
  const [showAddJob, setShowAddJob] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState<JobFilterValues>(emptyFilters);
  const [page, setPage] = useState<JobPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    async function loadJobs() {
      try {
        const parameters = new URLSearchParams({
          limit: "20",
          offset: String(offset),
        });
        if (filters.q) {
          parameters.set("q", filters.q);
        }
        if (filters.reviewStatus) {
          parameters.set("review_status", filters.reviewStatus);
        }
        if (filters.applicationStatus) {
          parameters.set("application_status", filters.applicationStatus);
        }
        if (view === "applications") {
          parameters.set("applications_only", "true");
        }

        const response = await fetch(`/api/jobs?${parameters}`, {
          signal: controller.signal,
        });

        // fetch only rejects network failures; HTTP errors need this check.
        if (!response.ok) {
          throw new Error("The server could not return the jobs");
        }

        const data: JobPage = await response.json();
        if (!controller.signal.aborted) {
          setPage(data);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(
            "Could not load your jobs. Check that the backend is running, then refresh.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadJobs();

    // Cancel the previous request before starting another or leaving the page.
    return () => controller.abort();
  }, [offset, refresh, filters, view]);

  function jobCreated() {
    setFilters(emptyFilters);
    setOffset(0);
    // Refresh even when we are already on the first page.
    setRefresh((current) => current + 1);
  }

  function applyFilters(values: JobFilterValues) {
    setOffset(0);
    setFilters(values);
  }

  function switchView(nextView: JobView) {
    if (nextView === view) return;
    setView(nextView);
    setShowAddJob(false);
    setFilters(emptyFilters);
    setOffset(0);
  }

  let emptyMessage =
    view === "applications"
      ? "No applications recorded yet."
      : "No jobs recorded yet.";
  if (filters.q || filters.reviewStatus || filters.applicationStatus) {
    emptyMessage =
      view === "applications"
        ? "No applications match these filters."
        : "No jobs match these filters.";
  }
  if (page && page.offset > 0) {
    emptyMessage = "No jobs on this page. Use Previous to go back.";
  }

  if (selectedJobId !== null) {
    return (
      <main>
        <p className="brand">JobTrack</p>
        <JobDetails
          jobId={selectedJobId}
          onBack={() => setSelectedJobId(null)}
          onUpdated={() => setRefresh((current) => current + 1)}
        />
      </main>
    );
  }

  return (
    <main>
      <header className="workspace-header">
        <p className="brand">JobTrack</p>
        <nav className="view-navigation" aria-label="Main views">
          <button
            type="button"
            aria-current={view === "jobs" ? "page" : undefined}
            onClick={() => switchView("jobs")}
          >
            My Jobs
          </button>
          <button
            type="button"
            aria-current={view === "applications" ? "page" : undefined}
            onClick={() => switchView("applications")}
          >
            Applications
          </button>
        </nav>
      </header>
      <div className="page-heading">
        <div>
          <h1>{view === "applications" ? "Applications" : "My Jobs"}</h1>
          <p>
            {view === "applications"
              ? "Track jobs you have applied to and their progress."
              : "Keep track of vacancies, your decisions, and your applications."}
          </p>
        </div>
        {view === "jobs" && (
          <button
            type="button"
            className="primary-button"
            aria-expanded={showAddJob}
            aria-controls="add-job-panel"
            onClick={() => setShowAddJob((current) => !current)}
          >
            {showAddJob ? "Close form" : "Add job"}
          </button>
        )}
      </div>
      {view === "jobs" && (
        <div id="add-job-panel" hidden={!showAddJob}>
          <AddJobForm onCreated={jobCreated} />
        </div>
      )}
      <section aria-label="Job list" className="jobs-panel">
        <h2>
          {view === "applications" ? "Recorded applications" : "Recorded jobs"}
        </h2>
        <JobFilters
          key={`${view}-${refresh}`}
          filters={filters}
          onApply={applyFilters}
          applicationsOnly={view === "applications"}
        />
        {loading && <p role="status">Loading your jobs…</p>}
        {error && <p role="alert">{error}</p>}
        {page && !loading && !error && (
          <>
            {page.items.length > 0 && (
              <p className="result-summary">
                Showing {page.offset + 1}–{page.offset + page.items.length} of{" "}
                {page.total} {view === "applications" ? "applications" : "jobs"}
                .
              </p>
            )}
            {page.items.length === 0 && <p>{emptyMessage}</p>}
            <ul className="job-list">
              {page.items.map((job) => (
                <li key={job.id}>
                  <h3>
                    <button
                      type="button"
                      className="job-title"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      {job.title}
                    </button>
                  </h3>
                  <p>
                    {job.company}
                    {job.location && (
                      <span className="job-location"> · {job.location}</span>
                    )}
                  </p>
                  <dl>
                    <div>
                      <dt>Review</dt>
                      <dd>
                        <span
                          className="status-badge"
                          data-status={job.review_status}
                        >
                          {statusLabels[job.review_status]}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Application</dt>
                      <dd>
                        <span
                          className="status-badge"
                          data-status={job.application_status}
                        >
                          {statusLabels[job.application_status]}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
        {page && (
          <nav className="pagination" aria-label="Job pages">
            <button
              type="button"
              disabled={loading || page.offset === 0}
              onClick={() => setOffset(Math.max(0, page.offset - page.limit))}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={
                loading ||
                page.offset + page.limit >= page.total ||
                page.offset + page.limit > 100000
              }
              onClick={() => setOffset(page.offset + page.limit)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}
