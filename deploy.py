#!/usr/bin/env python3
"""Deploy source to Vercel project 'buildfit-ai-app' (production). Vercel builds it (vite + /api functions)."""
import base64, json, os, urllib.request
TEAM = "team_oA0OnAK2n94FAtFyADMy1B9k"; ROOT = os.path.dirname(os.path.abspath(__file__))
SKIP = {"node_modules", "dist", ".git", "deploy.py"}
files = []
for d, ds, fs in os.walk(ROOT):
    ds[:] = [x for x in ds if x not in SKIP]
    for f in fs:
        if f in SKIP: continue
        p = os.path.join(d, f)
        files.append({"file": os.path.relpath(p, ROOT), "data": base64.b64encode(open(p, "rb").read()).decode(), "encoding": "base64"})
body = {"name": "buildfit-ai-app", "project": "buildfit-ai-app", "target": "production", "files": files,
        "projectSettings": {"framework": "vite", "buildCommand": "npm run build", "installCommand": "npm install", "outputDirectory": "dist"}}
req = urllib.request.Request(f"https://api.vercel.com/v13/deployments?teamId={TEAM}&skipAutoDetectionConfirmation=1",
                             data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
try:
    r = json.load(urllib.request.urlopen(req, timeout=100))
    print(json.dumps({k: r.get(k) for k in ("id", "url", "readyState", "alias")}, indent=1))
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:800])
