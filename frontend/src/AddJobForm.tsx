import { useState, type FormEvent } from "react";

type AddJobFormProps = {
  onCreated: () => void;
};

export default function AddJobForm(props: AddJobFormProps) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSuccess("");

    if (!title.trim() || !company.trim()) {
      setError("Enter a title and company, not just spaces.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || null,
          notes: notes || null,
          preferred_url: url.trim() || null,
        }),
      });

      if (response.status === 409) {
        const problem = await response.json();
        if (problem.detail?.message === "Job already recorded") {
          setError(
            "A job with this URL is already recorded. Your existing job has not been changed.",
          );
        } else {
          setError(
            "The job changed while saving. Refresh and check your jobs before trying again.",
          );
        }
        return;
      }
      if (response.status === 422) {
        setError(
          "Check the title, company, and optional fields. Location allows 200 characters and notes 20,000. Posting URLs must use http:// or https://.",
        );
        return;
      }
      if (!response.ok) {
        throw new Error("Save request failed");
      }

      setTitle("");
      setCompany("");
      setLocation("");
      setNotes("");
      setUrl("");
      setSuccess("Job added. Review: To review. Application: Not applied.");
      props.onCreated();
    } catch {
      // A lost response can happen after the server has committed the job.
      setError(
        "Could not confirm the save. Refresh and check your jobs before trying again. Your input is still here.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="add-job-heading">
      <h2 id="add-job-heading">Add a job</h2>
      <form onSubmit={saveJob}>
        <fieldset disabled={saving}>
          <label htmlFor="job-title">Job title</label>
          <input
            id="job-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={300}
          />
          <label htmlFor="job-company">Company</label>
          <input
            id="job-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            required
            maxLength={200}
          />
          <label htmlFor="job-location">Location (optional)</label>
          <input
            id="job-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={200}
          />
          <label htmlFor="job-url">Posting URL (optional)</label>
          <input
            id="job-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            maxLength={2048}
            aria-describedby="url-help"
          />
          <p id="url-help">
            Link to the posting on LinkedIn or another site. JobTrack stores the
            link without fetching the page. Without a URL, duplicates cannot be
            detected.
          </p>
          <label htmlFor="initial-notes">Initial notes (optional)</label>
          <textarea
            id="initial-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={20000}
            rows={4}
          />
          <button type="submit">{saving ? "Saving…" : "Add job"}</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </section>
  );
}
