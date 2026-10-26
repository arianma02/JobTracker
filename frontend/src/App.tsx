import { useEffect, useState } from "react";

type Job = {
  id: string;
  title: string;
  company: string;
  review_status: "to_review" | "interested" | "not_interested";
  application_status:
    | "not_applied"
    | "applied"
    | "interviewing"
    | "offer"
    | "rejected"
    | "withdrawn";
};

type JobPage = {
  items: Job[];
  total: number;
};

const statusLabels = {
  to_review: "To review",
  interested: "Interested",
  not_interested: "Not interested",
  not_applied: "Not applied",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default function App() {
  const [page, setPage] = useState<JobPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs?limit=20&offset=0", {
          signal: controller.signal,
        });

        // fetch only rejects network failures; HTTP errors need this check.
        if (!response.ok) {
          throw new Error("The server could not return the jobs");
        }

        const data: JobPage = await response.json();
        setPage(data);
      } catch {
        if (!controller.signal.aborted) {
          setError("Could not load your jobs. Check that the backend is running, then refresh.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadJobs();

    // Cancel the request if this page is removed before it finishes.
    return () => controller.abort();
  }, []);

  return (
    <main>
      <p className="brand">JobTrack</p>
      <h1>My Jobs</h1>
      <p>Keep track of vacancies, your decisions, and your applications.</p>
      <section aria-label="Job list">
        {loading && <p role="status">Loading your jobs…</p>}
        {error && <p role="alert">{error}</p>}
        {page && (
          <>
            <h2>Recorded jobs</h2>
            <p>Showing {page.items.length} of {page.total} jobs. First 20 only.</p>
            {page.items.length === 0 && <p>No jobs recorded yet.</p>}
            <ul className="job-list">
              {page.items.map((job) => (
                <li key={job.id}>
                  <h3>{job.title}</h3>
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
      </section>
    </main>
  );
}
