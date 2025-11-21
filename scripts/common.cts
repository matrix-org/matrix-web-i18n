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

import fs from "fs";
import { isBinaryExpression, isStringLiteral, isTemplateLiteral, Node } from "@babel/types";
import type { PluralisedTranslation, Translation, Translations } from "../src";

export const NESTING_KEY = process.env["NESTING_KEY"] || "|";
export const INPUT_FILE = process.env["INPUT_FILE"] || 'src/i18n/strings/en_EN.json';
export const OUTPUT_FILE = process.env["OUTPUT_FILE"] || 'src/i18n/strings/en_EN.json';

export function getPath(key: string): string[] {
    return key.replace(/\\n/g, "\n").split(NESTING_KEY);
}

export function getKeys(translations: Translations | Translation, path = ""): string[] {
    // base case
    if (typeof translations === "string" || "other" in translations) {
        return [path];
    }

    if (path) path += NESTING_KEY;
    return Object.keys(translations).flatMap(key => getKeys(translations[key], path + key));
}

export function getTranslations(file = INPUT_FILE): Readonly<Translations> {
     return JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }));
}

export function putTranslations(translations: Translations, file = OUTPUT_FILE): void {
    fs.writeFileSync(
        file,
        JSON.stringify(translations, null, 4) + "\n"
    );
}

export function getTKey(arg: Node): string | null {
    if (isStringLiteral(arg)) {
        return arg.value;
    } else if (isBinaryExpression(arg) && arg.operator === '+') {
        return getTKey(arg.left)! + getTKey(arg.right)!;
    } else if (isTemplateLiteral(arg)) {
        return arg.quasis.map(q => q.value.raw).join('');
    }
    return null;
}

export function isPluralisedTranslation(translation: Translations[string]): translation is PluralisedTranslation {
    return typeof translation === "object" && "other" in translation;
}

export type { PluralisedTranslation, Translations, Translation };
