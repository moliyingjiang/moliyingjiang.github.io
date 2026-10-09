#!/usr/bin/env python3
"""Mirror the owner's GitHub branches, tags and LFS objects to Gitee."""

import argparse
import base64
from datetime import datetime, timedelta, timezone
import json
import os
import pathlib
import subprocess
import tempfile
import urllib.parse
import urllib.error
import urllib.request

GITHUB_OWNER = "moliyingjiang"
GITEE_OWNER = "YJ-MoLi"
ROOT = pathlib.Path(__file__).resolve().parents[1]
MAPPING = json.loads((ROOT / ".github/repository-mirror-map.json").read_text())


def local_token(host):
    result = subprocess.run(
        ["git", "credential", "fill"],
        input=f"protocol=https\nhost={host}\n\n",
        text=True,
        capture_output=True,
        check=True,
    )
    return dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)["password"]


def api(url, token, method="GET", fields=None):
    body = urllib.parse.urlencode(fields).encode() if fields else None
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Authorization": f"token {token}" if "gitee.com" in url else f"Bearer {token}",
                 "Accept": "application/json", "User-Agent": "academic-repository-mirror"},
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)


def pages(url, token):
    result = []
    for number in range(1, 21):
        separator = "&" if "?" in url else "?"
        items = api(f"{url}{separator}per_page=100&page={number}", token)
        if not isinstance(items, list):
            raise RuntimeError("Repository listing did not return an array")
        result.extend(items)
        if len(items) < 100:
            return result
    raise RuntimeError("Repository listing exceeded 2,000 entries")


def github_json(url, token, method="GET", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method,
                                     headers={"Authorization": f"Bearer {token}",
                                              "Accept": "application/vnd.github+json",
                                              "Content-Type": "application/json",
                                              "User-Agent": "academic-repository-mirror"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response) if response.status != 204 else {}


def keep_scheduler_active(token):
    """Record quiet activity on a non-default branch before GitHub's 60-day cutoff."""
    base = f"https://api.github.com/repos/{GITHUB_OWNER}/moliyingjiang.github.io"
    branch = "automation-heartbeat"
    file_url = base + "/contents/.github/mirror-heartbeat.txt?ref=" + branch
    existing = None
    try:
        existing = github_json(file_url, token)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
    now = datetime.now(timezone.utc)
    if existing:
        previous = base64.b64decode(existing["content"]).decode().strip()
        try:
            if now - datetime.fromisoformat(previous) < timedelta(days=21):
                return
        except ValueError:
            pass
    else:
        try:
            github_json(base + "/git/refs", token, "POST",
                        {"ref": "refs/heads/" + branch, "sha": os.environ["GITHUB_SHA"]})
        except urllib.error.HTTPError as error:
            if error.code != 422:
                raise
    payload = {"message": "Keep scheduled repository mirroring active",
               "content": base64.b64encode(now.isoformat().encode()).decode(), "branch": branch}
    if existing:
        payload["sha"] = existing["sha"]
    github_json(base + "/contents/.github/mirror-heartbeat.txt", token, "PUT", payload)
    print("Scheduler heartbeat updated on its separate branch")


def git(command, env, cwd=None):
    result = subprocess.run(["git", *command], env=env, cwd=cwd, text=True,
                            capture_output=True)
    if result.returncode:
        raise RuntimeError(f"git {command[0]} failed: {result.stderr[-600:]}")
    return result.stdout


def refs(url, env):
    lines = git(["ls-remote", "--refs", url, "refs/heads/*", "refs/tags/*"], env)
    return {ref: sha for sha, ref in (line.split("\t", 1) for line in lines.splitlines())}


def credentials_environment(github_token, gitee_token, directory):
    helper = directory / "askpass.sh"
    helper.write_text("""#!/bin/sh
case "$1" in
  *github.com*) case "$1" in *Username*) printf 'x-access-token\\n';; *) printf '%s\\n' "$GH_SOURCE_TOKEN";; esac;;
  *gitee.com*) case "$1" in *Username*) printf 'YJ-MoLi\\n';; *) printf '%s\\n' "$GITEE_TOKEN";; esac;;
  *) exit 1;;
esac
""")
    helper.chmod(0o700)
    return {**os.environ, "GH_SOURCE_TOKEN": github_token, "GITEE_TOKEN": gitee_token,
            "GIT_ASKPASS": str(helper), "GIT_TERMINAL_PROMPT": "0"}


def synchronize(source, target, env, directory):
    before = refs(source, env)
    after = refs(target, env)
    if before == after:
        return "unchanged"
    with tempfile.TemporaryDirectory(prefix="repository-", dir=directory) as checkout:
        git(["clone", "--mirror", source, checkout], env)
        lfs = git(["-C", checkout, "lfs", "ls-files", "--all", "--name-only"], env)
        if lfs.strip():
            git(["-C", checkout, "lfs", "fetch", "--all", "origin"], env)
            git(["-C", checkout, "lfs", "push", "--all", target], env)
        git(["-C", checkout, "push", "--force", "--prune", target,
             "refs/heads/*:refs/heads/*", "refs/tags/*:refs/tags/*"], env)
    if refs(target, env) != before:
        raise RuntimeError("Branch/tag verification failed")
    return "updated"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--local-credentials", action="store_true")
    args = parser.parse_args()
    if args.local_credentials and not args.dry_run:
        parser.error("Local credentials can only be used with --dry-run")
    gh_token = local_token("github.com") if args.local_credentials else os.environ.get("GH_SOURCE_TOKEN")
    gt_token = local_token("gitee.com") if args.local_credentials else os.environ.get("GITEE_TOKEN")
    if not gh_token or not gt_token:
        raise RuntimeError("GH_SOURCE_TOKEN and GITEE_TOKEN must both be configured")
    if not args.dry_run:
        keep_scheduler_active(gh_token)
    github = pages("https://api.github.com/user/repos?affiliation=owner", gh_token)
    github = [repo for repo in github if repo["owner"]["login"].lower() == GITHUB_OWNER.lower()
              and not repo["fork"] and not repo["archived"]]
    gitee = pages("https://gitee.com/api/v5/user/repos?type=personal", gt_token)
    destinations = {repo["path"].lower(): repo for repo in gitee
                    if repo["owner"]["login"].lower() == GITEE_OWNER.lower()}
    print(f"GitHub owned active repositories: {len(github)}; Gitee personal repositories: {len(destinations)}")
    failures = []
    with tempfile.TemporaryDirectory(prefix="owned-repository-mirror-") as tmp:
        directory = pathlib.Path(tmp)
        env = credentials_environment(gh_token, gt_token, directory)
        for source in sorted(github, key=lambda repo: repo["name"].lower()):
            name = source["name"]
            destination_name = MAPPING.get(name, name)
            try:
                target = destinations.get(destination_name.lower())
                if not target and args.dry_run:
                    print(f"WOULD CREATE {name} -> {destination_name} ({'private' if source['private'] else 'public'})")
                    continue
                if not target:
                    target = api("https://gitee.com/api/v5/user/repos", gt_token, "POST",
                                 {"name": destination_name, "path": destination_name,
                                  "namespace": GITEE_OWNER, "private": str(source["private"]).lower(),
                                  "auto_init": "false"})
                    if target.get("owner", {}).get("login", "").lower() != GITEE_OWNER.lower():
                        raise RuntimeError("Created repository was not placed in the intended personal account")
                    destinations[target["path"].lower()] = target
                if bool(target["private"]) != bool(source["private"]):
                    raise RuntimeError("Visibility differs between GitHub and Gitee; no data was pushed")
                source_url = f"https://github.com/{GITHUB_OWNER}/{name}.git"
                target_url = f"https://gitee.com/{GITEE_OWNER}/{target['path']}.git"
                if args.dry_run:
                    action = "unchanged" if refs(source_url, env) == refs(target_url, env) else "WOULD UPDATE"
                else:
                    action = synchronize(source_url, target_url, env, directory)
                print(f"{action}: {name} -> {target['path']}")
            except Exception as error:
                print(f"FAILED: {name}: {error}")
                failures.append(name)
    if failures:
        raise SystemExit(f"Mirror failed for {len(failures)} repositories: {', '.join(failures)}")


if __name__ == "__main__":
    main()
