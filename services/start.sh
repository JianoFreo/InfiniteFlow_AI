#!/bin/bash
# The "npm run start" of the core container: it starts both Java apps.

# Stop right away with a clear message if a database address is missing
: "${JOBS_DB_URL:?Missing required env var: JOBS_DB_URL}"
: "${MEDIA_DB_URL:?Missing required env var: MEDIA_DB_URL}"

# Each app gets its own port, database and memory limit. "&" runs it in the background.
PORT=8082 DB_URL="$MEDIA_DB_URL" java -Xmx384m -jar media.jar &
PORT=8081 DB_URL="$JOBS_DB_URL" java -Xmx512m -jar job.jar &

# When Railway redeploys, pass the stop signal on to both apps (like TechCare's SIGTERM handler)
trap 'kill $(jobs -p) 2>/dev/null; wait; exit 0' TERM INT

# If either app exits, stop the container so Railway restarts it
wait -n
kill $(jobs -p) 2>/dev/null
exit 1
