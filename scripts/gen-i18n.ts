/*
Copyright 2017-2023 The Matrix.org Foundation C.I.C.

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
 * Regenerates the translations en_EN file by walking the source tree and
 * parsing each file with the appropriate parser. Emits a JSON file with the
 * translatable strings mapped to themselves in the order they appeared
 * in the files and grouped by the file they appeared in.
 *
 * Usage: node scripts/gen-i18n.js
 */

import * as path from "path";
import * as fs from "fs";
import { WalkOptions, walkSync } from "walk";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import {
    isStringLiteral,
    isIdentifier,
    isCallExpression,
    isNewExpression,
    isObjectProperty,
    isObjectExpression,
    ObjectExpression,
} from "@babel/types";
import { ParserPlugin } from "@babel/parser";
import _ from "lodash";
import {
    getPath, getTKey,
    getTranslations,
    OUTPUT_FILE,
    putTranslations,
} from "./common";
import { Translation, Translations } from "../src";

// Find the package.json for the project we're running gen-18n against
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
const DEFAULT_SEARCH_PATHS = ['src', 'res'];

function getObjectValue(obj: ObjectExpression, key: string): any {
    for (const prop of obj.properties) {
        if (isObjectProperty(prop) && isIdentifier(prop.key) && prop.key.name === key) {
            return prop.value;
        }
    }
    return null;
}

function getFormatStrings(str: string): Set<string> {
    // Match anything that starts with %
    // We could make a regex that matched the full placeholder, but this
    // would just not match invalid placeholders and so wouldn't help us
    // detect the invalid ones.
    // Also note that for simplicity, this just matches a % character and then
    // anything up to the next % character (or a single %, or end of string).
    const formatStringRe = /%([^%]+|%|$)/g;
    const formatStrings = new Set<string>();

    let match: RegExpExecArray | null;
    while ( (match = formatStringRe.exec(str)) !== null ) {
        const placeholder = match[1]; // Minus the leading '%'
        if (placeholder === '%') continue; // Literal % is %%

        const placeholderMatch = placeholder.match(/^\((.*?)\)(.)/);
        if (placeholderMatch === null) {
            throw new Error("Invalid format specifier: '"+match[0]+"'");
        }
        if (placeholderMatch.length < 3) {
            throw new Error("Malformed format specifier");
        }
        const placeholderName = placeholderMatch[1];
        const placeholderFormat = placeholderMatch[2];

        if (placeholderFormat !== 's') {
            throw new Error(`'${placeholderFormat}' used as format character: you probably meant 's'`);
        }

        formatStrings.add(placeholderName);
    }

    return formatStrings;
}

function getTranslationsJs(file: string, translations: Readonly<Translations>): [keys: Set<string>, plurals: Set<string>] {
    const contents = fs.readFileSync(file, { encoding: 'utf8' });

    const keys = new Set<string>();
    const plurals = new Set<string>();

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

                    // check the format string against the args
                    // We only check _t: _td has no args
                    if (isIdentifier(p.node.callee) && p.node.callee.name === '_t') {
                        try {
                            const rawValue: Translation | undefined = _.get(translations, getPath(tKey));
                            const englishValue = typeof rawValue === "string" ? rawValue : rawValue?.other;

                            if (englishValue) {
                                const placeholders = getFormatStrings(englishValue);
                                for (const placeholder of placeholders) {
                                    if (p.node.arguments.length < 2 || !isObjectExpression(p.node.arguments[1])) {
                                        throw new Error(`Placeholder found ('${placeholder}') but no substitutions given`);
                                    }
                                    const value = getObjectValue(p.node.arguments[1], placeholder);
                                    if (value === null) {
                                        throw new Error(`No value found for placeholder '${placeholder}'`);
                                    }
                                }

                                // Validate tag replacements
                                if (p.node.arguments.length > 2 && isObjectExpression(p.node.arguments[2])) {
                                    const tagMap = p.node.arguments[2];
                                    for (const prop of tagMap.properties || []) {
                                        if (isObjectProperty(prop) && (isStringLiteral(prop.key) || isIdentifier(prop.key))) {
                                            const tag = isIdentifier(prop.key) ? prop.key.name : prop.key.value;

                                            // RegExp same as in src/languageHandler.js
                                            const regexp = new RegExp(`(<${tag}>(.*?)<\\/${tag}>|<${tag}>|<${tag}\\s*\\/>)`);
                                            if (!englishValue.match(regexp)) {
                                                throw new Error(`No match for ${regexp} in ${englishValue}`);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.log();
                            console.error(`ERROR: ${file}:${p.node.loc?.start.line} ${tKey}`);
                            console.error(e);
                            process.exit(1);
                        }
                    }

                    let isPlural = false;
                    if (p.node.arguments.length > 1 && p.node.arguments[1].type === 'ObjectExpression') {
                        const countVal = getObjectValue(p.node.arguments[1], 'count');
                        if (countVal) {
                            isPlural = true;
                        }
                    }

                    keys.add(tKey);
                    if (isPlural) {
                        plurals.add(tKey);
                    }
                }
            },
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    return [keys, plurals];
}

function getTranslationsOther(file: string): Set<string> {
    const contents = fs.readFileSync(file, { encoding: 'utf8' });

    const trs = new Set<string>();

    // Taken from element-web src/components/structures/HomePage.js
    const translationsRegex = /_t\(['"]([\s\S]*?)['"]\)/mg;
    let matches: RegExpExecArray | null;
    while (matches = translationsRegex.exec(contents)) {
        trs.add(matches[1]);
    }
    return trs;
}

const inputTranslationsRaw = getTranslations();
const translatables = new Set<string>();
const plurals = new Set<string>();

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

            let keys: Set<string>;
            let pluralKeys = new Set<string>();
            if (fileStats.name.endsWith('.js') || fileStats.name.endsWith('.ts') || fileStats.name.endsWith('.tsx')) {
                [keys, pluralKeys] = getTranslationsJs(fullPath, inputTranslationsRaw);
            } else if (fileStats.name.endsWith('.html')) {
                keys = getTranslationsOther(fullPath);
            } else {
                return;
            }
            console.log(`${fullPath} (${keys.size} strings)`);
            for (const tr of keys) {
                // Convert DOS line endings to unix
                const key = tr.replace(/\r\n/g, "\n");
                translatables.add(key);
                if (pluralKeys.has(tr)) {
                    plurals.add(key);
                }
            }
        },
    }
};

// Take search paths from arguments
const searchPaths = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_SEARCH_PATHS;

console.log(`Searching for translations in: ${searchPaths.join(",")}`);

for (const path of searchPaths) {
    if (fs.existsSync(path)) {
        walkSync(path, walkOpts);
    }
}

const trObj: Translations = {};
for (const tr of translatables) {
    const path = getPath(tr);
    if (_.get(inputTranslationsRaw, path)) {
        _.set(trObj, path, _.get(inputTranslationsRaw, path));
    } else if (!plurals.has(tr)) {
        _.set(trObj, path, tr);
    } else {
        _.set(trObj, path, {
            "other": tr,
            "one": tr,
        })
    }
}

putTranslations(trObj);

console.log();
console.log(`Wrote ${translatables.size} strings to ${OUTPUT_FILE}`);
