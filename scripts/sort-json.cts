/*
Copyright 2026 Aditya Cherukuru

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Cross-platform JSON key sorting utility.
 * Replaces the need for `jq --sort-keys` which has issues on Windows due to:
 * - jq not being installed by default
 * - Shell quoting differences ('.' vs ".")
 *
 * Usage: matrix-sort-i18n <file.json> [file2.json ...]
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Recursively sorts the keys of an object alphabetically.
 * Arrays are preserved as-is (not sorted), but objects within arrays are sorted.
 */
function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }

    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
        sortedObj[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sortedObj;
}

/**
 * Sorts JSON file keys and writes back to the same file.
 */
function sortJsonFile(filePath: string): void {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    let parsed: unknown;

    try {
        parsed = JSON.parse(content);
    } catch (e) {
        throw new Error(`Invalid JSON in file: ${absolutePath}`);
    }

    const sorted = sortObjectKeys(parsed);
    const output = JSON.stringify(sorted, null, 4) + "\n";

    fs.writeFileSync(absolutePath, output, "utf8");
    console.log(`Sorted keys in: ${filePath}`);
}

// Main execution
if (process.argv.length < 3) {
    console.error("Usage: matrix-sort-i18n <file.json> [file2.json ...]");
    console.error("Sorts JSON object keys alphabetically in-place.");
    process.exit(1);
}

const files = process.argv.slice(2);
let hasError = false;

for (const file of files) {
    try {
        sortJsonFile(file);
    } catch (e) {
        console.error(`Error processing ${file}:`, (e as Error).message);
        hasError = true;
    }
}

if (hasError) {
    process.exit(1);
}
