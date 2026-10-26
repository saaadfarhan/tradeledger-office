#!/usr/bin/env bash
set -eu

project_root="$(cd "$(dirname "$0")/.." && pwd)"
driver="$project_root/lib/sqlite-jdbc.jar"
if [ ! -f "$driver" ]; then
    echo "SQLite JDBC driver not found: $driver" >&2
    exit 1
fi

"$project_root/scripts/test.sh"
javac -source 8 -target 8 -cp "$project_root/build/classes:$driver" -d "$project_root/build/test-classes" "$project_root/src/test/java/com/purchasesale/sqlite/SQLitePersistenceTest.java"
java -cp "$project_root/build/classes:$project_root/build/test-classes:$driver" com.purchasesale.sqlite.SQLitePersistenceTest
