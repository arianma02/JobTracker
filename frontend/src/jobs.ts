export type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  notes: string | null;
  preferred_url: string | null;
  review_status: "to_review" | "interested" | "not_interested";
  application_status:
    | "not_applied"
    | "applied"
    | "interviewing"
    | "offer"
    | "rejected"
    | "withdrawn";
};

export type JobPage = {
  items: Job[];
  total: number;
  limit: number;
  offset: number;
};

export type JobFilterValues = {
  q: string;
  reviewStatus: Job["review_status"] | "";
  applicationStatus: Job["application_status"] | "";
};

export const emptyFilters: JobFilterValues = {
  q: "",
  reviewStatus: "",
  applicationStatus: "",
};

export const reviewStatuses: Job["review_status"][] = [
  "to_review",
  "interested",
  "not_interested",
];

export const applicationStatuses: Job["application_status"][] = [
  "not_applied",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

export const statusLabels = {
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
