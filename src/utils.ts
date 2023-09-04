/*
Copyright 2017 MTRNord and Cooperative EITA
Copyright 2017 Vector Creations Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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
 * Returns a language string with underscores replaced with
 * hyphens, and lower-cased.
 *
 * @param {string} language The language string to be normalized
 * @returns {string} The normalized language string
 */
export function normalizeLanguageKey(language: string): string {
    return language.toLowerCase().replace("_", "-");
}

/**
 * Turns a language string, normalises it,
 * (see normalizeLanguageKey) into an array of language strings
 * with fallback to generic languages
 * (e.g. 'pt-BR' => ['pt-br', 'pt'])
 *
 * @param language The input language string
 * @return a list of normalised languages
 */
export function getNormalizedLanguageKeys(language: string): string[] {
    const languageKeys: string[] = [];
    const normalizedLanguage = normalizeLanguageKey(language);
    const languageParts = normalizedLanguage.split("-");
    if (languageParts.length === 2 && languageParts[0] === languageParts[1]) {
        languageKeys.push(languageParts[0]);
    } else {
        languageKeys.push(normalizedLanguage);
        if (languageParts.length === 2) {
            languageKeys.push(languageParts[0]);
        }
    }
    return languageKeys;
}
