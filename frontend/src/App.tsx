import { useEffect, useState } from "react";
import AddJobForm from "./AddJobForm";
import JobDetails from "./JobDetails";
import { statusLabels, type JobPage } from "./jobs";

export default function App() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState<JobPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    async function loadJobs() {
      try {
        const response = await fetch(`/api/jobs?limit=20&offset=${offset}`, {
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

    // Cancel the old request when the offset changes or the page is removed.
    return () => controller.abort();
  }, [offset, refresh]);

  function jobCreated() {
    setOffset(0);
    // Refresh even when we are already on the first page.
    setRefresh((current) => current + 1);
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
        {loading && <p role="status">Loading your jobs…</p>}
        {error && <p role="alert">{error}</p>}
        {page && !loading && !error && (
          <>
            <h2>Recorded jobs</h2>
            {page.items.length > 0 && (
              <p>
                Showing {page.offset + 1}–{page.offset + page.items.length} of{" "}
                {page.total} jobs.
              </p>
            )}
            {page.items.length === 0 && (
              <p>
                {page.offset === 0
                  ? "No jobs recorded yet."
                  : "No jobs on this page. Use Previous to go back."}
              </p>
            )}
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
