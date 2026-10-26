import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import JobEditor from "./JobEditor";
import type { Job } from "./jobs";

const fetchMock = vi.fn<typeof fetch>();
const onSaved = vi.fn();
const onCancel = vi.fn();
const job: Job = {
  id: "synthetic-job",
  title: "Developer",
  company: "Example AB",
  location: null,
  preferred_url: null,
  notes: "Original notes",
  review_status: "interested",
  application_status: "not_applied",
};

beforeEach(() => {
  fetchMock.mockReset();
  onSaved.mockReset();
  onCancel.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderEditor() {
  render(<JobEditor job={job} onSaved={onSaved} onCancel={onCancel} />);
}

test("starts with saved values and cancels without sending a request", () => {
  renderEditor();
  expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe(
    "Original notes",
  );
  expect(
    (screen.getByLabelText("Review status") as HTMLSelectElement).value,
  ).toBe("interested");
  expect(
    (screen.getByLabelText("Application status") as HTMLSelectElement).value,
  ).toBe("not_applied");
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Unsaved draft" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Cancel edits" }));

  expect(onCancel).toHaveBeenCalledOnce();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(job.notes).toBe("Original notes");
});

test("PATCHes notes and independent statuses and returns the saved record", async () => {
  const updatedJob = {
    ...job,
    notes: "Line one\nLine two",
    review_status: "not_interested",
    application_status: "rejected",
  };
  fetchMock.mockResolvedValue(Response.json(updatedJob));
  renderEditor();
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: updatedJob.notes },
  });
  fireEvent.change(screen.getByLabelText("Review status"), {
    target: { value: "not_interested" },
  });
  fireEvent.change(screen.getByLabelText("Application status"), {
    target: { value: "rejected" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(updatedJob));
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/jobs/synthetic-job");
  expect(options?.method).toBe("PATCH");
  expect(options?.headers).toEqual({ "Content-Type": "application/json" });
  expect(JSON.parse(String(options?.body))).toEqual({
    notes: updatedJob.notes,
    review_status: "not_interested",
    application_status: "rejected",
  });
});

test("allows notes to be cleared without changing statuses", async () => {
  fetchMock.mockResolvedValue(Response.json({ ...job, notes: "" }));
  renderEditor();
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "" } });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    notes: "",
    review_status: "interested",
    application_status: "not_applied",
  });
});

test("preserves draft edits when the server fails", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
  renderEditor();
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Keep this draft" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not confirm the save",
  );
  expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe(
    "Keep this draft",
  );
  expect(onSaved).not.toHaveBeenCalled();
});

test("shows backend validation feedback without discarding the draft", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 422 }));
  renderEditor();

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect((await screen.findByRole("alert")).textContent).toContain(
    "20,000 characters",
  );
  expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe(
    "Original notes",
  );
  expect(onSaved).not.toHaveBeenCalled();
});

test("disables controls and repeat submissions while saving", () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  renderEditor();

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(screen.getByLabelText("Notes").matches(":disabled")).toBe(true);
  expect(
    screen.getByRole("button", { name: "Cancel edits" }).matches(":disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
  expect(fetchMock).toHaveBeenCalledOnce();
});
