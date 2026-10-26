from urllib.parse import unquote_plus, urlsplit, urlunsplit

TRACKING_PARAMETERS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"
}


def normalize_url(value):
    # urlsplit silently removes some control characters, so reject them first.
    for character in value:
        if ord(character) < 32 or ord(character) == 127:
            raise ValueError("URL must not contain control characters")

    value = value.strip()
    if any(character.isspace() for character in value) or "\\" in value:
        raise ValueError("URL must not contain whitespace or backslashes")

    parts = urlsplit(value)
    scheme = parts.scheme.lower()
    if scheme not in {"http", "https"} or not parts.hostname:
        raise ValueError("Use an absolute http or https URL")
    if parts.username is not None or parts.password is not None:
        raise ValueError("URL must not contain credentials")
    if parts.netloc.endswith(":"):
        raise ValueError("URL port must not be empty")

    host = parts.hostname.lower()
    if ":" in host:
        host = f"[{host}]"
    port = parts.port
    if port is not None:
        default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
        if not default_port:
            host = f"{host}:{port}"

    kept_parameters = []
    for parameter in parts.query.split("&"):
        name = parameter.split("=", 1)[0]
        if unquote_plus(name).lower() not in TRACKING_PARAMETERS:
            kept_parameters.append(parameter)
    query = "&".join(kept_parameters)

    normalized_url = urlunsplit((scheme, host, parts.path, query, ""))
    # Preserve an explicitly empty query; removing tracking parameters is separate.
    if parts.query == "" and "?" in value.split("#", 1)[0]:
        normalized_url += "?"

    # Keep the exact key small enough for PostgreSQL's unique B-tree index.
    if len(normalized_url.encode("utf-8")) > 2048:
        raise ValueError("Normalized URL must not exceed 2048 UTF-8 bytes")

    return normalized_url


def find_job_by_url(cursor, normalized_url):
    cursor.execute(
        """
        SELECT jobs.* FROM jobs
        JOIN job_identifiers ON jobs.id = job_identifiers.job_id
        WHERE job_identifiers.namespace = 'normalized-url'
          AND job_identifiers.value = %s
        """,
        (normalized_url,),
    )
    return cursor.fetchone()
