from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from job_identity import normalize_url

ReviewStatus = Literal["to_review", "interested", "not_interested"]
ApplicationStatus = Literal[
    "not_applied", "applied", "interviewing", "offer", "rejected", "withdrawn"
]


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    company: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=20000)
    preferred_url: str | None = Field(default=None, min_length=1, max_length=2048)

    @field_validator("preferred_url")
    @classmethod
    def validate_posting_url(cls, value):
        if value is not None:
            normalize_url(value)
            return value.strip()
        return value

    @field_validator("title", "company", "location", mode="before")
    @classmethod
    def strip_surrounding_whitespace(cls, value):
        # Trim before checking lengths, so whitespace alone is not a valid title.
        if isinstance(value, str):
            return value.strip()
        return value


class JobPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = Field(default=None, max_length=20000)
    review_status: ReviewStatus | None = None
    application_status: ApplicationStatus | None = None

    @field_validator("review_status", "application_status")
    @classmethod
    def status_cannot_be_cleared(cls, value):
        # Omitted defaults are not validated; an explicitly submitted null is.
        if value is None:
            raise ValueError("Status cannot be null")
        return value
