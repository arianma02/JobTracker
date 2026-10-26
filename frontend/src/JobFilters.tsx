import { useState, type FormEvent } from "react";
import {
  applicationStatuses,
  emptyFilters,
  reviewStatuses,
  statusLabels,
  type JobFilterValues,
} from "./jobs";

type JobFiltersProps = {
  filters: JobFilterValues;
  onApply: (filters: JobFilterValues) => void;
  applicationsOnly: boolean;
};

export default function JobFilters(props: JobFiltersProps) {
  const [draft, setDraft] = useState(props.filters);
  const availableApplicationStatuses = props.applicationsOnly
    ? applicationStatuses.filter((status) => status !== "not_applied")
    : applicationStatuses;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onApply({ ...draft, q: draft.q.trim() });
  }

  function clearFilters() {
    setDraft(emptyFilters);
    props.onApply(emptyFilters);
  }

  return (
    <form
      onSubmit={applyFilters}
      aria-label="Filter jobs"
      className="job-filters"
    >
      <div className="filter-field filter-search">
        <label htmlFor="job-search">Search recorded jobs</label>
        <input
          id="job-search"
          type="search"
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          maxLength={200}
          aria-describedby="search-help"
        />
      </div>
      <div className="filter-field">
        <label htmlFor="review-filter">Review status filter</label>
        <select
          id="review-filter"
          value={draft.reviewStatus}
          onChange={(event) =>
            setDraft({
              ...draft,
              reviewStatus: event.target
                .value as JobFilterValues["reviewStatus"],
            })
          }
        >
          <option value="">All review statuses</option>
          {reviewStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor="application-filter">Application status filter</label>
        <select
          id="application-filter"
          value={draft.applicationStatus}
          onChange={(event) =>
            setDraft({
              ...draft,
              applicationStatus: event.target
                .value as JobFilterValues["applicationStatus"],
            })
          }
        >
          <option value="">
            {props.applicationsOnly
              ? "All applications"
              : "All application statuses"}
          </option>
          {availableApplicationStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <p id="search-help">
        Search title, company, or notes. Apply filters to update the results.
      </p>
      <div className="form-actions filter-actions">
        <button type="submit">Apply filters</button>
        <button type="button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    </form>
  );
}
