import { useState, type FormEvent } from "react";
import {
  applicationStatuses,
  reviewStatuses,
  statusLabels,
  type Job,
} from "./jobs";

type JobEditorProps = {
  job: Job;
  onSaved: (job: Job) => void;
  onCancel: () => void;
};

export default function JobEditor(props: JobEditorProps) {
  const [notes, setNotes] = useState(props.job.notes ?? "");
  const [reviewStatus, setReviewStatus] = useState(props.job.review_status);
  const [applicationStatus, setApplicationStatus] = useState(
    props.job.application_status,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/jobs/${props.job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          review_status: reviewStatus,
          application_status: applicationStatus,
        }),
      });
      if (response.status === 404) {
        setError("This job could not be found. Cancel edits to go back.");
        return;
      }
      if (response.status === 422) {
        setError(
          "Check the status selections and keep notes within 20,000 characters.",
        );
        return;
      }
      if (!response.ok) {
        throw new Error("Update request failed");
      }

      const updatedJob: Job = await response.json();
      props.onSaved(updatedJob);
    } catch {
      setError(
        "Could not confirm the save. Your edits are still here. If the connection was lost, the server may already have saved them.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveChanges} aria-label="Edit job">
      <h2>Edit notes and statuses</h2>
      <p>Save your changes, or cancel edits to discard them.</p>
      <fieldset disabled={saving}>
        <label htmlFor="review-status">Review status</label>
        <select
          id="review-status"
          value={reviewStatus}
          onChange={(event) =>
            setReviewStatus(event.target.value as Job["review_status"])
          }
        >
          {reviewStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <label htmlFor="application-status">Application status</label>
        <select
          id="application-status"
          value={applicationStatus}
          onChange={(event) =>
            setApplicationStatus(
              event.target.value as Job["application_status"],
            )
          }
        >
          {applicationStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <label htmlFor="job-notes">Notes</label>
        <textarea
          id="job-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={20000}
          rows={6}
        />
        <div className="form-actions">
          <button type="submit">{saving ? "Saving…" : "Save changes"}</button>
          <button type="button" onClick={props.onCancel}>
            Cancel edits
          </button>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
