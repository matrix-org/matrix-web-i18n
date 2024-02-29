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
 * Applies the following lint rules to the src/i18n/strings/en_EN.json file:
 *  + ensures the translation key is not equal to its value
 *  + ensures the translation key contains only alphanumerics and underscores (temporarily allows @ and . for compatibility)
 *  + ensures no forbidden hardcoded words are found (specified new line delimited in environment variable HARDCODED_WORDS)
 *    unless they are explicitly allowed (keys specified new line delimited in environment variable ALLOWED_HARDCODED_KEYS)
 *
 * Usage: node scripts/lint-i18n.js
 */

import { getTranslations, isPluralisedTranslation, NESTING_KEY, Translation, Translations } from "./common";

const hardcodedWords = process.env.HARDCODED_WORDS?.toLowerCase().split("\n").map(k => k.trim()) ?? [];
const allowedHardcodedKeys = process.env.ALLOWED_HARDCODED_KEYS?.split("\n").map(k => k.trim()) ?? [];

const input = getTranslations();

function nonNullable<T>(value: T): value is NonNullable<T> {
    return value !== null && value !== undefined;
}

function expandTranslations(translation: Translation): string[] {
    if (isPluralisedTranslation(translation)) {
        return [translation.one, translation.other].filter(nonNullable)
    } else {
        return [translation];
    }
}

function lintTranslation(keys: string[], value: Translation): boolean {
    const key = keys[keys.length - 1];
    const fullKey = keys.join(NESTING_KEY);

    // Check for invalid characters in the translation key
    if (!!key.replace(/[a-z0-9@_.]+/gi, "")) {
        console.log(`"${fullKey}": key contains invalid characters`);
        return true;
    }

    // Check that the translated string does not match the key.
    if (key === input[key] || (isPluralisedTranslation(value) && (key === value.other || key === value.one))) {
        console.log(`"${fullKey}": key matches value`);
        return true;
    }

    if (hardcodedWords.length > 0) {
        const words = expandTranslations(value).join(" ").toLowerCase().split(" ");
        if (!allowedHardcodedKeys.includes(fullKey) && hardcodedWords.some(word => words.includes(word))) {
            console.log(`"${fullKey}": contains forbidden hardcoded word`);
            return true;
        }
    }

    return false;
}

function traverseTranslations(translations: Translations, keys: string[] = []): string[] {
    const filtered: string[] = [];
    Object.keys(translations).forEach(key => {
        const value = translations[key];

        if (typeof value === "object" && !isPluralisedTranslation(value)) {
            filtered.push(...traverseTranslations(value, [...keys, key]));
            return;
        }

        if (lintTranslation([...keys, key], value)) {
            filtered.push(key);
        }
    });
    return filtered;
}

const filtered = traverseTranslations(input);

if (filtered.length > 0) {
    console.log(`${filtered.length} invalid translation keys`);
    process.exit(1);
}
