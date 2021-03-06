/*
Copyright 2017 New Vector Ltd

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

/*
 * Looks through all the translation files and removes any strings
 * which don't appear in en_EN.json.
 * Use this if you remove a translation, but merge any outstanding changes
 * from Weblate first, or you'll need to resolve the conflict in Weblate.
 */

import * as path from "path";
import * as fs from "fs";

const I18NDIR = 'src/i18n/strings';

type TranslationFile = {
    [key: string]: string;
}

const enStringsRaw = JSON.parse(fs.readFileSync(path.join(I18NDIR, 'en_EN.json')).toString()) as TranslationFile;

const enStrings = new Set<string>();
for (const str of Object.keys(enStringsRaw)) {
    const parts = str.split('|');
    if (parts.length > 1) {
        enStrings.add(parts[0]);
    } else {
        enStrings.add(str);
    }
}

for (const filename of fs.readdirSync(I18NDIR)) {
    if (filename === 'en_EN.json') continue;
    if (filename === 'basefile.json') continue;
    if (!filename.endsWith('.json')) continue;

    const trs = JSON.parse(fs.readFileSync(path.join(I18NDIR, filename)).toString()) as TranslationFile;
    const oldLen = Object.keys(trs).length;
    for (const tr of Object.keys(trs)) {
        const parts = tr.split('|');
        const trKey = parts.length > 1 ? parts[0] : tr;
        if (!enStrings.has(trKey)) {
            delete trs[tr];
        }

        // Clean up for when a string gets pluralised,
        // to not leave behind the un-pluralised variant which causes warnings
        if (parts.length > 1 && trKey in trs) {
            delete trs[trKey];
        }
    }

    const removed = oldLen - Object.keys(trs).length;
    if (removed > 0) {
        console.log(`${filename}: removed ${removed} translations`);
        // XXX: This is totally relying on the impl serialising the JSON object in the
        // same order as they were parsed from the file. JSON.stringify() has a specific argument
        // that can be used to control the order, but JSON.parse() lacks any kind of equivalent.
        // Empirically this does maintain the order on my system, so I'm going to leave it like
        // this for now.
        fs.writeFileSync(path.join(I18NDIR, filename), JSON.stringify(trs, undefined, 4) + "\n");
    }
}
