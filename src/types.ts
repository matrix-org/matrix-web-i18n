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

import { KEY_SEPARATOR } from "./index";

/**
 * Utility type for string dot notation for accessing nested object properties.
 * Based on https://stackoverflow.com/a/58436959
 * @example
 *  {
 *      "a": {
 *          "b": {
 *              "c": "value"
 *          },
 *          "d": "foobar"
 *      }
 *  }
 *  will yield a type of `"a.b.c" | "a.d"` with Separator="."
 * @typeParam Target the target type to generate leaf keys for
 * @typeParam Separator the separator to use between key segments when accessing nested objects
 * @typeParam LeafType the type which leaves of this object extend, used to determine when to stop recursion
 * @typeParam MaxDepth the maximum depth to recurse to
 * @returns a union type representing all dot (Separator) string notation keys which can access a Leaf (of LeafType)
 */
export type Leaves<Target, Separator extends string = ".", LeafType = string, MaxDepth extends number = 3> = [
    MaxDepth,
] extends [never]
    ? never
    : Target extends LeafType
        ? ""
        : {
            [K in keyof Target]-?: Join<K, Leaves<Target[K], Separator, LeafType, Prev[MaxDepth]>, Separator>;
        }[keyof Target];
type Prev = [never, 0, 1, 2, 3, ...0[]];
type Join<K, P, S extends string = "."> = K extends string | number
    ? P extends string | number
        ? `${K}${"" extends P ? "" : S}${P}`
        : never
    : never;

/**
 * Utility type for |-separated keys indexing into a translations file
 * @typeParam Translations the target type to generate leaf keys for
 * @typeParam Separator the separator to use between key segments when accessing nested objects
 * @typeParam LeafType the type which leaves of this object extend, used to determine when to stop recursion
 * @typeParam MaxDepth the maximum depth to recurse to
 * @returns a union type representing all dot (Separator) string notation keys which can access a Leaf (of LeafType)
 */
export type TranslationKey<T extends Translations> = Leaves<T, typeof KEY_SEPARATOR, string | { other: string }, 4>;

export type Translation = string | {
    one?: string;
    other: string;
};

export interface Translations {
    [key: string]: Translation | Translations;
}
