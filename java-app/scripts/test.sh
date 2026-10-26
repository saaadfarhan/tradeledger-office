#!/usr/bin/env bash
set -eu

project_root="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$project_root/build/classes"
test_dir="$project_root/build/test-classes"
rm -rf "$project_root/build"
mkdir -p "$build_dir" "$test_dir"
javac -source 8 -target 8 -d "$build_dir" $(find "$project_root/src/main/java" -name '*.java' -print)
javac -source 8 -target 8 -cp "$build_dir" -d "$test_dir" $(find "$project_root/src/test/java" -name '*.java' -print)
java -cp "$build_dir:$test_dir" com.purchasesale.domain.InMemoryAccountRepositoryTest
java -cp "$build_dir:$test_dir" com.purchasesale.domain.InMemoryBankRepositoryTest
java -cp "$build_dir:$test_dir" com.purchasesale.domain.InventoryAndVoucherTest
java -cp "$build_dir:$test_dir" com.purchasesale.domain.ChallanTest
java -cp "$build_dir:$test_dir" com.purchasesale.domain.VoucherRepositoryTest
