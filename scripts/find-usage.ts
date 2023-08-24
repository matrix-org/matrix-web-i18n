/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
 * Finds code usages of a specific i18n key or count of usages per key if no key specified
 */

import * as path from "path";
import * as fs from "fs";
import { WalkOptions, walkSync } from "walk";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import {
    isIdentifier,
    isCallExpression,
    isNewExpression,
} from "@babel/types";
import { ParserPlugin } from "@babel/parser";
import _ from "lodash";
import { getTKey } from "./common";

// Find the package.json for the project we're running against
const projectPackageJsonPath = path.join(process.cwd(), 'package.json');
const projectPackageJson = require(projectPackageJsonPath);

const TRANSLATIONS_FUNCS = ['_t', '_td', '_tDom']
    // Add some addition translation functions to look out that are specified
    // per project in package.json under the
    // "matrix_i18n_extra_translation_funcs" key
    .concat(projectPackageJson.matrix_i18n_extra_translation_funcs || []);

// NB. The sync version of walk is broken for single files,
// so we walk all of res rather than just res/home.html.
// https://git.daplie.com/Daplie/node-walk/merge_requests/1 fixes it,
// or if we get bored waiting for it to be merged, we could switch
// to a project that's actively maintained.
const SEARCH_PATHS = ['src', 'res'];

function getTranslationsJs(file: string): Map<string, string[]> {
    const contents = fs.readFileSync(file, { encoding: 'utf8' });

    const trs = new Map<string, string[]>();

    try {
        const plugins: ParserPlugin[] = [
            // https://babeljs.io/docs/en/babel-parser#plugins
            "classProperties",
            "objectRestSpread",
            "throwExpressions",
            "exportDefaultFrom",
            "decorators-legacy",
        ];

        if (file.endsWith(".js") || file.endsWith(".jsx")) {
            // All JS is assumed to be React
            plugins.push("jsx");
        } else if (file.endsWith(".ts")) {
            // TS can't use JSX unless it's a TSX file (otherwise angle casts fail)
            plugins.push("typescript");
        } else if (file.endsWith(".tsx")) {
            // When the file is a TSX file though, enable JSX parsing
            plugins.push("typescript", "jsx");
        }

        const babelParsed = parser.parse(contents, {
            allowImportExportEverywhere: true,
            errorRecovery: true,
            sourceFilename: file,
            tokens: true,
            plugins,
        });
        traverse(babelParsed, {
            enter: (p) => {
                if (
                    (isNewExpression(p.node) || isCallExpression(p.node)) &&
                    isIdentifier(p.node.callee) &&
                    TRANSLATIONS_FUNCS.includes(p.node.callee.name)
                ) {
                    const tKey = getTKey(p.node.arguments[0]);

                    // This happens whenever we call _t with non-literals (ie. whenever we've
                    // had to use a _td to compensate) so is expected.
                    if (tKey === null) return;

                    if (trs.has(tKey)) {
                        trs.get(tKey)!.push(file);
                    } else {
                        trs.set(tKey, [file]);
                    }
                }
            },
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    return trs;
}

function getTranslationsOther(file: string): Map<string, string[]> {
    const contents = fs.readFileSync(file, { encoding: 'utf8' });

    const trs = new Map<string, string[]>();

    // Taken from element-web src/components/structures/HomePage.js
    const translationsRegex = /_t\(['"]([\s\S]*?)['"]\)/mg;
    let matches: RegExpExecArray | null;
    while (matches = translationsRegex.exec(contents)) {
        if (trs.has(matches[1])) {
            trs.get(matches[1])!.push(file);
        } else {
            trs.set(matches[1], [file]);
        }
    }
    return trs;
}

const keyUsages = new Map<string, string[]>();

const walkOpts: WalkOptions = {
    listeners: {
        names: function(root, nodeNamesArray) {
            // Sort the names case insensitively and alphabetically to
            // maintain some sense of order between the different strings.
            nodeNamesArray.sort((a, b) => {
                a = a.toLowerCase();
                b = b.toLowerCase();
                if (a > b) return 1;
                if (a < b) return -1;
                return 0;
            });
        },
        file: function(root, fileStats, next) {
            const fullPath = path.join(root, fileStats.name);

            let trs: Map<string, string[]>;
            if (fileStats.name.endsWith('.js') || fileStats.name.endsWith('.ts') || fileStats.name.endsWith('.tsx')) {
                trs = getTranslationsJs(fullPath);
            } else if (fileStats.name.endsWith('.html')) {
                trs = getTranslationsOther(fullPath);
            } else {
                return;
            }

            for (const key of trs.keys()) {
                if (keyUsages.has(key)) {
                    keyUsages.get(key)!.push(...trs.get(key)!);
                } else {
                    keyUsages.set(key, trs.get(key)!);
                }
            }
        },
    }
};

for (const path of SEARCH_PATHS) {
    if (fs.existsSync(path)) {
        walkSync(path, walkOpts);
    }
}

const key = process.argv[2];

if (key) {
    console.log(`Consumers of "${key}":`, keyUsages.get(key));
} else {
    const sorted = _.sortBy([...keyUsages.keys()], k => -keyUsages.get(k)!.length);
    console.table(Object.fromEntries(sorted.map(key => [key.substring(0, 120), keyUsages.get(key)!.length])));
}
