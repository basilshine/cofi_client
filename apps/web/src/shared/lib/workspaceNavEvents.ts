/** Fired when chat scope or active-org tenant id changes (same-tab + listeners). */
export const WORKSPACE_NAV_UPDATED_EVENT = "ceits:workspace-nav-updated";

export const notifyWorkspaceNavUpdated = (): void => {
	window.dispatchEvent(new CustomEvent(WORKSPACE_NAV_UPDATED_EVENT));
};
