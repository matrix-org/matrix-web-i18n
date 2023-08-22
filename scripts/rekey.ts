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

import parseArgs from "minimist";
import _ from "lodash";
import { getPath, getTranslations, putTranslations, Translations } from "./common";
import fs from "fs";
import path from "path";

const I18NDIR = "src/i18n/strings";

const argv = parseArgs<{
    copy: boolean;
}>(process.argv.slice(2), {
    boolean: ["copy", "move", "case-insensitive", "find-and-replace"],
});

const [oldPath, newPath] = argv._.map(getPath);
const sourceTranslations = getTranslations();

const translation = _.get(sourceTranslations, oldPath);
if (!translation) {
    throw new Error("Old key not present in source translations");
}

function updateTranslations(translations: Translations): void {
    const value = _.get(translations, oldPath);
    if (!value) return;

    _.set(translations, newPath, _.get(translations, oldPath));

    if (!argv.copy) {
        _.unset(translations, oldPath);
    }
}

for (const filename of fs.readdirSync(I18NDIR)) {
    if (!filename.endsWith(".json")) continue;
    const file = path.join(I18NDIR, filename);
    const translations = getTranslations(file);
    updateTranslations(translations);
    putTranslations(translations, file);
}



