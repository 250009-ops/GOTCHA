"""SSH helpers for the catalog export. Prints command output only, never secrets."""
import json
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[4]


def deploy_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / "deploy" / ".env").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value.strip().strip('"').strip("'")
    return env


def connect() -> paramiko.SSHClient:
    env = deploy_env()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(env["IP"], username="root", password=env["PASSWORD"], timeout=30, banner_timeout=30)
    return client


def run(client: paramiko.SSHClient, cmd: str, stdin_text: str | None = None, timeout: int = 600) -> bytes:
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    if stdin_text is not None:
        stdin.write(stdin_text)
        stdin.channel.shutdown_write()
    out = stdout.read()
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise SystemExit(f"remote exit {code}: {err[-500:]}")
    return out


DUMP_SQL = r"""
SELECT json_build_object(
    'id', s.id,
    'contentId', s.content_id,
    'lang', c.language::text,
    'title', c.title,
    'pageIndex', s.page_index,
    'wordCount', s.word_count,
    'active', (
      SELECT count(*) FROM page_questions pq
      WHERE pq.segment_id = s.id AND pq.status = 'active'
    ),
    'text', s.plain_text
  )::text
  FROM content_segments s
  JOIN content_items c ON c.id = s.content_id
  WHERE c.publish_status = 'published'
    AND c.content_source <> 'user_import'
    AND c.content_type <> 'user_import'
"""


def dump(path: Path) -> None:
    client = connect()
    try:
        data = run(
            client,
            "docker exec -i gotcha-postgres psql -U gotcha -d gotcha -v ON_ERROR_STOP=1 -At",
            DUMP_SQL,
            timeout=900,
        )
    finally:
        client.close()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    lines = data.count(b"\n")
    print(f"DUMP_OK bytes={len(data)} lines={lines}")


def batches() -> None:
    client = connect()
    try:
        raw = run(client, "cat /var/www/gotcha/services/api/mashq-batch-state.json")
    finally:
        client.close()
    state = json.loads(raw.decode("utf-8"))
    print(json.dumps({
        "batches": [
            {"id": row.get("id"), "status": row.get("status"), "outputDone": row.get("outputDone"), "count": row.get("count")}
            for row in state.get("batches") or []
        ]
    }))


def psql_file(path: Path) -> None:
    client = connect()
    try:
        sftp = client.open_sftp()
        remote = "/tmp/gotcha-content-apply.sql"
        sftp.put(str(path), remote)
        sftp.close()
        out = run(
            client,
            f"cat {remote} | docker exec -i gotcha-postgres psql -U gotcha -d gotcha -v ON_ERROR_STOP=1",
            timeout=900,
        )
        run(client, f"rm -f {remote}")
    finally:
        client.close()
    sys.stdout.buffer.write(out)


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "dump":
        dump(Path(sys.argv[2]))
    elif cmd == "batches":
        batches()
    elif cmd == "psql":
        psql_file(Path(sys.argv[2]))
    else:
        raise SystemExit("usage: remote.py dump|batches|psql <path>")


if __name__ == "__main__":
    main()
