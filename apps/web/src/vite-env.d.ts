/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string;
	/** Marketing site origin (`https://ceits.app`). Dev default: http://127.0.0.1:5173 */
	readonly VITE_MARKETING_URL?: string;
	readonly VITE_CEITS_APP_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
