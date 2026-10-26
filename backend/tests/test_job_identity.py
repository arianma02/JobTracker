import pytest

from job_identity import normalize_url


def test_normalization_removes_known_noise():
    assert normalize_url(
        "HTTPS://Example.COM:443/Job?id=42&utm_source=email#details"
    ) == ("https://example.com/Job?id=42")


def test_unknown_and_repeated_query_parameters_are_preserved():
    url = "https://example.com/job?id=1&id=2&custom=a%2Bb&utm_custom=keep"
    assert normalize_url(url) == url


@pytest.mark.parametrize(
    "first, second",
    [
        ("http://example.com/job", "https://example.com/job"),
        ("https://example.com/job", "https://example.com/job/"),
        ("https://example.com/Job", "https://example.com/job"),
        ("https://example.com/job?id=1", "https://example.com/job?id=2"),
        ("https://example.com/job?a=1&b=2", "https://example.com/job?b=2&a=1"),
        ("https://example.com", "https://example.com/"),
        ("https://example.com/job?", "https://example.com/job"),
    ],
)
def test_conservative_url_distinctions(first, second):
    assert normalize_url(first) != normalize_url(second)


def test_nondefault_port_and_ipv6_brackets_are_preserved():
    assert normalize_url("http://[::1]:8080/job#details") == "http://[::1]:8080/job"
