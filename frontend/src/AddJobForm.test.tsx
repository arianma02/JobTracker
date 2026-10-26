import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AddJobForm from "./AddJobForm";

const fetchMock = vi.fn<typeof fetch>();
const onCreated = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  onCreated.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillForm(title = "Developer") {
  fireEvent.change(screen.getByLabelText("Job title"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText("Company"), {
    target: { value: "Example AB" },
  });
}

test("posts trimmed input and clears the form after a successful save", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ id: "synthetic-job" }, { status: 201 }),
  );
  render(<AddJobForm onCreated={onCreated} />);
  fillForm(" Developer ");
  fireEvent.change(screen.getByLabelText("Location (optional)"), {
    target: { value: " Stockholm " },
  });
  fireEvent.change(screen.getByLabelText("Initial notes (optional)"), {
    target: { value: "First line\n  Keep this indentation." },
  });
  fireEvent.change(screen.getByLabelText("Posting URL (optional)"), {
    target: { value: "https://example.com/job/1" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  await screen.findByRole("status");
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/jobs");
  expect(options?.method).toBe("POST");
  expect(options?.headers).toEqual({ "Content-Type": "application/json" });
  expect(JSON.parse(String(options?.body))).toEqual({
    title: "Developer",
    company: "Example AB",
    location: "Stockholm",
    notes: "First line\n  Keep this indentation.",
    preferred_url: "https://example.com/job/1",
  });
  expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe(
    "",
  );
  expect(onCreated).toHaveBeenCalledOnce();
  expect(
    (screen.getByLabelText("Location (optional)") as HTMLInputElement).value,
  ).toBe("");
  expect(
    (screen.getByLabelText("Initial notes (optional)") as HTMLTextAreaElement)
      .value,
  ).toBe("");
});

test("sends null for empty optional fields", async () => {
  fetchMock.mockResolvedValue(Response.json({}, { status: 201 }));
  render(<AddJobForm onCreated={onCreated} />);
  fillForm();

  fireEvent.change(screen.getByLabelText("Location (optional)"), {
    target: { value: "   " },
  });

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  await screen.findByRole("status");
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(body.preferred_url).toBeNull();
  expect(body.location).toBeNull();
  expect(body.notes).toBeNull();
});

test("preserves input and reports a duplicate without reporting creation", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      { detail: { message: "Job already recorded", job_id: "existing-job" } },
      { status: 409 },
    ),
  );
  render(<AddJobForm onCreated={onCreated} />);
  fillForm();
  fireEvent.change(screen.getByLabelText("Location (optional)"), {
    target: { value: "Stockholm" },
  });
  fireEvent.change(screen.getByLabelText("Initial notes (optional)"), {
    target: { value: "Keep this draft" },
  });
  fireEvent.change(screen.getByLabelText("Posting URL (optional)"), {
    target: { value: "https://example.com/job/1" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  expect((await screen.findByRole("alert")).textContent).toContain(
    "already recorded",
  );
  expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe(
    "Developer",
  );
  expect(onCreated).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("Location (optional)") as HTMLInputElement).value,
  ).toBe("Stockholm");
  expect(
    (screen.getByLabelText("Initial notes (optional)") as HTMLTextAreaElement)
      .value,
  ).toBe("Keep this draft");
});

test("shows a validation error from the backend", async () => {
  fetchMock.mockResolvedValue(Response.json({ detail: [] }, { status: 422 }));
  render(<AddJobForm onCreated={onCreated} />);
  fillForm();

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Check the title, company, and optional fields",
  );
  expect(onCreated).not.toHaveBeenCalled();
});

test("keeps input when a save cannot be confirmed", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network unavailable"));
  render(<AddJobForm onCreated={onCreated} />);
  fillForm();

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not confirm the save",
  );
  expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe(
    "Developer",
  );
  expect(onCreated).not.toHaveBeenCalled();
});

test("rejects whitespace-only titles before making a request", () => {
  render(<AddJobForm onCreated={onCreated} />);
  fillForm("   ");

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  expect(screen.getByRole("alert").textContent).toContain("not just spaces");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("disables the form while saving to prevent repeat submissions", () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  render(<AddJobForm onCreated={onCreated} />);
  fillForm();

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));
  const button = screen.getByRole("button", { name: "Saving…" });
  expect(button.matches(":disabled")).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledOnce();
});
