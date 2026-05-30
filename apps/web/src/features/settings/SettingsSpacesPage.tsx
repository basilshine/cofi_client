import { Link } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";

const sectionCard =
	"rounded-2xl border border-border/70 bg-card text-card-foreground soft-shadow inner-glow";
const sectionEyebrow = "eyebrow";
const buttonBase =
	"inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-[background-color,color,transform] hover:bg-accent active:scale-[0.96] disabled:opacity-50";

const initial = (name: string) => {
	const text = name.trim();
	return text ? text.charAt(0).toUpperCase() : "?";
};

export const SettingsSpacesPage = () => {
	const { spaces, isLoading, loadError, setCreateSpaceDialogOpen } =
		useWorkspaceSpaces();

	useConsoleHeaderTitle("Spaces", null);

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
				<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
					<header className="space-y-2">
						<p className={sectionEyebrow}>Settings</p>
						<h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
							Spaces
						</h1>
						<p className="max-w-2xl text-pretty text-sm text-muted-foreground">
							Choose a space to manage its members, invites, identity,
							appearance, and destructive actions.
						</p>
					</header>

					{loadError ? (
						<div
							className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
							role="alert"
						>
							{loadError}
						</div>
					) : null}

					<section className={sectionCard}>
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-6 py-4">
							<div>
								<p className={sectionEyebrow}>Space settings</p>
								<h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
									Your spaces
								</h2>
							</div>
							<button
								className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90`}
								onClick={() => setCreateSpaceDialogOpen(true)}
								type="button"
							>
								New space
							</button>
						</div>
						<div className="p-4 sm:p-6">
							{isLoading && !spaces ? (
								<p className="text-sm text-muted-foreground">
									Loading spaces...
								</p>
							) : null}

							{spaces?.length ? (
								<ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
									{spaces.map((space) => (
										<li key={String(space.id)}>
											<Link
												className="group flex min-h-[8.5rem] flex-col justify-between rounded-2xl border border-border/70 bg-background p-4 shadow-sm transition-[background-color,border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
												to={`/console/settings/spaces/${encodeURIComponent(String(space.id))}`}
											>
												<div className="flex items-start gap-3">
													<span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
														{initial(space.name)}
													</span>
													<span className="min-w-0">
														<span className="block truncate font-display text-lg font-bold tracking-tight text-foreground">
															{space.name || "Untitled space"}
														</span>
														<span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
															{space.description?.trim() ||
																"Members, invites, appearance, and space actions."}
														</span>
													</span>
												</div>
												<span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-foreground">
													Open settings
												</span>
											</Link>
										</li>
									))}
								</ul>
							) : !isLoading ? (
								<div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
									No spaces yet. Create one to start shared capture and splits.
								</div>
							) : null}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
};
