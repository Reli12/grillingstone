// The names of the files in a Prototype Session's folder. A module of its own so the Permission Guard, which runs
// in a hook on every tool call, can name the one writable file without loading the rest of the Prototype code.
export const DRAFT_FILE = 'draft.md'
export const GLOSSARY_FILE = 'CONTEXT.md'
export const IMAGES_FILE = 'images.md'
/** The one file Claude writes. */
export const PROTOTYPE_FILE = 'prototype.html'
export const START_ASSUMPTIONS_FILE = 'start-assumptions.md'
export const IMAGES_FOLDER = 'images'
