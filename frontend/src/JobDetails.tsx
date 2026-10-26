import { useEffect, useState } from "react";
import { statusLabels, type Job } from "./jobs";
import JobEditor from "./JobEditor";

type JobDetailsProps = {
  jobId: string;
  onBack: () => void;
  onUpdated?: () => void;
};

export default function JobDetails(props: JobDetailsProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setJob(null);
    setLoading(true);
    setError("");
    setEditing(false);
    setSuccess("");

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

  function jobSaved(updatedJob: Job) {
    setJob(updatedJob);
    setEditing(false);
    setSuccess("Changes saved.");
    props.onUpdated?.();
  }

  return (
    <>
      <button type="button" onClick={props.onBack} disabled={editing} autoFocus>
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
            {editing ? (
              <JobEditor
                job={job}
                onSaved={jobSaved}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
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
                <button
                  type="button"
                  onClick={() => {
                    setSuccess("");
                    setEditing(true);
                  }}
                >
                  Edit notes and statuses
                </button>
              </>
            )}
            {success && <p role="status">{success}</p>}
            {job.preferred_url && /^https?:\/\//i.test(job.preferred_url) ? (
              <a
                href={job.preferred_url}
                target="_blank"
                rel="noopener noreferrer"
                className="posting-link"
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
