import { useEffect, useState } from "react";
import { statusLabels, type Job } from "./jobs";

type JobDetailsProps = {
  jobId: string;
  onBack: () => void;
};

export default function JobDetails(props: JobDetailsProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setJob(null);
    setLoading(true);
    setError("");

    async function loadJob() {
      try {
        const response = await fetch(`/api/jobs/${props.jobId}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          if (!controller.signal.aborted) {
            setError("This job could not be found.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Could not load job details");
        }

        const data: Job = await response.json();
        if (!controller.signal.aborted) {
          setJob(data);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Could not load job details. Go back and try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadJob();
    return () => controller.abort();
  }, [props.jobId]);

  return (
    <>
      <button type="button" onClick={props.onBack} autoFocus>
        Back to jobs
      </button>
      <section aria-label="Job details">
        {loading && <p role="status">Loading job details…</p>}
        {error && <p role="alert">{error}</p>}
        {job && (
          <>
            <h1>{job.title}</h1>
            <p>{job.company}</p>
            <p>{job.location || "Location not provided"}</p>
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
            <h2>Notes</h2>
            <p className="job-notes">{job.notes || "No notes yet."}</p>
            {job.preferred_url && /^https?:\/\//i.test(job.preferred_url) ? (
              <a
                href={job.preferred_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original posting (new tab)
              </a>
            ) : (
              <p>No posting link available.</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
