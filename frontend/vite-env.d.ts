/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string | undefined;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}