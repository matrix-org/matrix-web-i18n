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
 *  + ensures the translation key contains only alphanumerics and underscores
 *
 * Usage: node scripts/lint-i18n.js
 */

import { getTranslations, isTranslation } from "./common";

const input = getTranslations();

const filtered = Object.keys(input).filter(key => {
    const value = input[key];
    if (!!key.replace(/[a-z0-9_]+/g, "")) {
        console.log(`"${key}": key contains invalid characters`);
        return true;
    }
    if (key === input[key] || (isTranslation(value) && (key === value.other || key === value.one))) {
        console.log(`"${key}": key matches value`);
        return true;
    }
    return false;
});

if (filtered.length > 0) {
    console.log(`${filtered.length} invalid translation keys`);
    process.exit(1);
}
