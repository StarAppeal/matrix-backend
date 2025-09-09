// vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        /**
         * globals: true
         * Das ist der wichtigste Punkt, um dein ursprüngliches Problem zu lösen.
         * Diese Option weist Vitest an, die globalen APIs (describe, it, expect, vi)
         * automatisch in allen Testdateien verfügbar zu machen.
         */
        globals: true,

        /**
         * environment: 'node'
         * Dies simuliert eine Node.js-Umgebung für deine Tests.
         * Es ist essenziell für Backend-Tests, da es Node.js-APIs wie `process`
         * zur Verfügung stellt.
         */
        environment: 'node',

        /**
         * setupFiles: ['./tests/setup.ts']
         * (Optional, aber sehr nützlich)
         * Hier kannst du eine Datei angeben, die vor ALLEN Tests einmalig ausgeführt wird.
         * Perfekt, um z.B. eine Verbindung zu einer Test-Datenbank aufzubauen oder
         * globale Mocks zu definieren.
         * Du kannst diese Zeile erstmal auskommentieren, wenn du sie nicht brauchst.
         */
        // setupFiles: ['./tests/setup.ts'],
    },
});