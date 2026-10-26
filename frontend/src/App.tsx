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

export default function App() {
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
  }, [offset, refresh, filters]);

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

  let emptyMessage = "No jobs recorded yet.";
  if (filters.q || filters.reviewStatus || filters.applicationStatus) {
    emptyMessage = "No jobs match these filters.";
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
      <p className="brand">JobTrack</p>
      <h1>My Jobs</h1>
      <p>Keep track of vacancies, your decisions, and your applications.</p>
      <AddJobForm onCreated={jobCreated} />
      <section aria-label="Job list">
        <h2>Recorded jobs</h2>
        <JobFilters key={refresh} filters={filters} onApply={applyFilters} />
        {loading && <p role="status">Loading your jobs…</p>}
        {error && <p role="alert">{error}</p>}
        {page && !loading && !error && (
          <>
            {page.items.length > 0 && (
              <p>
                Showing {page.offset + 1}–{page.offset + page.items.length} of{" "}
                {page.total} jobs.
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
                  <p>{job.company}</p>
                  <dl>
                    <div>
                      <dt>Review</dt>
                      <dd>{statusLabels[job.review_status]}</dd>
                    </div>
                    <div>
                      <dt>Application</dt>
                      <dd>{statusLabels[job.application_status]}</dd>
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
