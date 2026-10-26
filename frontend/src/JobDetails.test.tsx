import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import JobDetails from "./JobDetails";
import type { Job } from "./jobs";

const fetchMock = vi.fn<typeof fetch>();
const job: Job = {
  id: "synthetic-job",
  title: "Python developer",
  company: "Example AB",
  location: "Stockholm",
  notes: "First line\n<script>example</script>",
  preferred_url: "https://example.com/jobs/1",
  review_status: "interested",
  application_status: "interviewing",
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows loading while job details are pending", () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  render(<JobDetails jobId={job.id} onBack={() => {}} />);

  expect(screen.getByRole("status").textContent).toBe("Loading job details…");
});

test("fetches the selected job and displays notes as plain text", async () => {
  fetchMock.mockResolvedValue(Response.json(job));
  const { container } = render(<JobDetails jobId={job.id} onBack={() => {}} />);

  await screen.findByRole("heading", { name: "Python developer" });
  expect(fetchMock.mock.calls[0][0]).toBe("/api/jobs/synthetic-job");
  expect(screen.getByText("Stockholm")).toBeTruthy();
  expect(screen.getByText("Interested")).toBeTruthy();
  expect(screen.getByText("Interviewing")).toBeTruthy();
  expect(screen.getByText(/First line/).textContent).toBe(job.notes);
  expect(container.querySelector("script")).toBeNull();
  const link = screen.getByRole("link", {
    name: "Open original posting (new tab)",
  });
  expect(link.getAttribute("href")).toBe(job.preferred_url);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});

test("handles missing location, notes, and URL", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ ...job, location: null, notes: null, preferred_url: null }),
  );
  render(<JobDetails jobId={job.id} onBack={() => {}} />);

  await screen.findByText("No notes yet.");
  expect(screen.getByText("Location not provided")).toBeTruthy();
  expect(screen.getByText("No posting link available.")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});

test("does not render an unsafe posting URL as a link", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ ...job, preferred_url: "javascript:alert(1)" }),
  );
  render(<JobDetails jobId={job.id} onBack={() => {}} />);

  await screen.findByText("No posting link available.");
  expect(screen.queryByRole("link")).toBeNull();
});

test("explains when the selected job is missing", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
  render(<JobDetails jobId={job.id} onBack={() => {}} />);

  expect((await screen.findByRole("alert")).textContent).toBe(
    "This job could not be found.",
  );
  expect(screen.queryByRole("status")).toBeNull();
});

test("shows an error when the server cannot return details", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
  render(<JobDetails jobId={job.id} onBack={() => {}} />);

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Go back and try again",
  );
  expect(screen.queryByRole("status")).toBeNull();
});
