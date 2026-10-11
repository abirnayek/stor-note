---
description: Automatically build, commit, and push to GitHub (deploy) after every code modification
---

# Automatic Deployment Policy

Whenever any code modifications, fixes, or feature updates are completed and verified:
1. Ensure the code compiles cleanly (`npm run build`).
2. Automatically commit the changes with a meaningful commit message.
3. Push to GitHub (`git push origin main`) immediately so the changes are deployed and accessible across all devices without requiring manual instructions.
