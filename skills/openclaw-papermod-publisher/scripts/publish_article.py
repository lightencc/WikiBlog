#!/usr/bin/env python3
"""Upload a structured article JSON file to WikiBlog API."""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def parse_args():
  parser = argparse.ArgumentParser(description="Upload article JSON to WikiBlog API")
  parser.add_argument("--api", required=True, help="API endpoint, e.g. http://localhost:4321/api/v1/articles")
  parser.add_argument("--input", required=True, help="Absolute path to article JSON")
  parser.add_argument("--api-key", default=os.getenv("OPENCLAW_API_KEY", ""), help="x-api-key value")
  parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout seconds")
  return parser.parse_args()


def load_payload(path):
  with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

  required = ["title", "contentMarkdown"]
  missing = [field for field in required if not payload.get(field)]
  if missing:
    raise ValueError(f"missing required field(s): {', '.join(missing)}")

  return payload


def upload(api_url, payload, api_key, timeout):
  body = json.dumps(payload).encode("utf-8")
  request = urllib.request.Request(api_url, data=body, method="POST")
  request.add_header("Content-Type", "application/json")

  if api_key:
    request.add_header("x-api-key", api_key)

  opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

  with opener.open(request, timeout=timeout) as response:
    raw = response.read().decode("utf-8")
    return response.status, json.loads(raw)


def main():
  args = parse_args()

  try:
    payload = load_payload(args.input)
    status, data = upload(args.api, payload, args.api_key, args.timeout)
  except ValueError as error:
    print(f"[ERROR] {error}")
    return 2
  except urllib.error.HTTPError as error:
    message = error.read().decode("utf-8", errors="replace")
    print(f"[ERROR] HTTP {error.code}: {message}")
    return 3
  except urllib.error.URLError as error:
    print(f"[ERROR] network error: {error}")
    return 4

  print(f"[OK] HTTP {status}")
  print(json.dumps(data, ensure_ascii=False, indent=2))
  return 0


if __name__ == "__main__":
  sys.exit(main())
