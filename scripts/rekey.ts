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
import fs from "fs";
import path from "path";

import { getPath, getTranslations, putTranslations } from "./common";
import { Translations } from "../src";

const I18NDIR = "src/i18n/strings";

const argv = parseArgs<{
    copy: boolean;
}>(process.argv.slice(2), {
    boolean: ["copy"],
});

const [oldPath, newPath] = argv._.map(getPath);
const sourceTranslations = getTranslations();

const translation = _.get(sourceTranslations, oldPath);
if (!translation) {
    throw new Error(`"${argv._[0]}" key not present in source translations`);
}
if (_.get(sourceTranslations, newPath)) {
    throw new Error(`"${argv._[1]}" key already present in source translations`);
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



